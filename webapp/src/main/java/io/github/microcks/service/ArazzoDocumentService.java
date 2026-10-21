/*
 * Copyright The Microcks Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.github.microcks.service;

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.ArazzoSourceLink;
import io.github.microcks.domain.ArazzoSources;
import io.github.microcks.domain.ArazzoWorkflowStatus;
import io.github.microcks.domain.ServiceRef;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.ArazzoSourcesRepository;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.util.MockRepositoryImportException;
import io.github.microcks.util.ObjectMapperFactory;
import io.github.microcks.util.arazzo.ArazzoDescription;
import io.github.microcks.util.arazzo.ArazzoDocumentReader;
import io.github.microcks.util.arazzo.UnsupportedArazzoDocumentException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service bean for common processing around Arazzo documents.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoDocumentService {

   private static final String ARAZZO_SOURCES_KIND = "ArazzoSources";

   private final ArazzoDocumentRepository arazzoDocumentRepository;
   private final ArazzoSourcesRepository arazzoSourcesRepository;
   private final ServiceRepository serviceRepository;

   /**
    * Build a new ArazzoDocumentService with its required dependencies.
    * @param arazzoDocumentRepository The repository of imported Arazzo documents
    * @param arazzoSourcesRepository  The repository of imported ArazzoSources overlays
    * @param serviceRepository        The repository of the APIs the source descriptions are linked to
    */
   public ArazzoDocumentService(ArazzoDocumentRepository arazzoDocumentRepository,
         ArazzoSourcesRepository arazzoSourcesRepository, ServiceRepository serviceRepository) {
      this.arazzoDocumentRepository = arazzoDocumentRepository;
      this.arazzoSourcesRepository = arazzoSourcesRepository;
      this.serviceRepository = serviceRepository;
   }

   /**
    * Tell whether an uploaded artifact is an Arazzo document, to import it with this service rather than as an API.
    * @param content The artifact as uploaded
    * @return Whether the artifact is an Arazzo document
    */
   public boolean isArazzoDocument(String content) {
      try {
         return ArazzoDocumentReader.isArazzoDocument(ObjectMapperFactory.getYamlObjectMapper().readTree(content));
      } catch (JsonProcessingException jpe) {
         return false;
      }
   }

   /**
    * Tell whether an uploaded artifact is an ArazzoSources overlay, to import it with this service rather than as an
    * API.
    * @param content The artifact as uploaded
    * @return Whether the artifact is an ArazzoSources overlay
    */
   public boolean isArazzoSources(String content) {
      try {
         return ARAZZO_SOURCES_KIND
               .equals(ObjectMapperFactory.getYamlObjectMapper().readTree(content).path("kind").asText());
      } catch (JsonProcessingException jpe) {
         return false;
      }
   }

   /**
    * Import an Arazzo document so that its workflows are kept in Microcks.
    * @param content The document as uploaded, in YAML or JSON
    * @return The imported document
    * @throws MockRepositoryImportException if the document cannot be imported
    */
   public ArazzoDocument importArazzoDocument(String content) throws MockRepositoryImportException {
      JsonNode parsed = parse(content);
      ArazzoDescription description = read(parsed);
      // Re-importing the same title and version updates the existing document.
      ArazzoDocument document = arazzoDocumentRepository.findByTitleAndVersion(description.title(),
            description.version());
      if (document == null) {
         document = new ArazzoDocument();
      }
      document.setTitle(description.title());
      document.setVersion(description.version());
      document.setWorkflowIds(description.workflowIds());
      document.setSourceNames(ArazzoDocumentReader.sourceDescriptionNames(parsed));
      document.setWorkflowSourceNames(ArazzoDocumentReader.workflowSourceNames(parsed));
      document.setContent(content);
      return arazzoDocumentRepository.save(document);
   }

   /**
    * Import an ArazzoSources overlay, that gives the Microcks API name and version of each source description of the
    * Arazzo document with the same title and version.
    * @param content The overlay as uploaded, in YAML or JSON
    * @return The imported overlay
    * @throws MockRepositoryImportException if the overlay cannot be imported
    */
   public ArazzoSources importArazzoSources(String content) throws MockRepositoryImportException {
      JsonNode overlay = parse(content);
      Map<String, ServiceRef> sources = new HashMap<>();
      for (Map.Entry<String, JsonNode> source : overlay.path("sources").properties()) {
         sources.put(source.getKey(), new ServiceRef(null, source.getValue().path("name").asText(),
               source.getValue().path("version").asText()));
      }
      ArazzoSources arazzoSources = new ArazzoSources();
      arazzoSources.setName(overlay.path("metadata").path("name").asText());
      arazzoSources.setVersion(overlay.path("metadata").path("version").asText());
      arazzoSources.setSources(sources);
      return arazzoSourcesRepository.save(arazzoSources);
   }

   /**
    * Link each source description of an Arazzo document to the Microcks API its overlay gives the name and version of.
    * @param title   The title of the Arazzo document
    * @param version The version of the Arazzo document
    * @return The link of each source description, in the order of the document
    */
   public List<ArazzoSourceLink> getSourceLinks(String title, String version) {
      ArazzoDocument document = arazzoDocumentRepository.findByTitleAndVersion(title, version);
      ArazzoSources overlay = arazzoSourcesRepository.findByNameAndVersion(title, version);
      return document.getSourceNames().stream().map(sourceName -> link(sourceName, overlay)).toList();
   }

   /**
    * Tell, for each workflow of an Arazzo document, whether it can run against the APIs of Microcks.
    * @param title   The title of the Arazzo document
    * @param version The version of the Arazzo document
    * @return The status of each workflow, in the order of the document
    */
   public List<ArazzoWorkflowStatus> getWorkflowStatuses(String title, String version) {
      ArazzoDocument document = arazzoDocumentRepository.findByTitleAndVersion(title, version);
      Map<String, ArazzoSourceLink> links = getSourceLinks(title, version).stream()
            .collect(Collectors.toMap(ArazzoSourceLink::sourceName, link -> link));
      return document.getWorkflowIds().stream()
            .map(workflowId -> status(workflowId, document.getWorkflowSourceNames().get(workflowId), links)).toList();
   }

   /** A workflow is runnable when nothing prevents its steps from calling their source; else these are the reasons. */
   private static ArazzoWorkflowStatus status(String workflowId, List<String> calledSourceNames,
         Map<String, ArazzoSourceLink> links) {
      List<String> reasons = new ArrayList<>();
      for (String sourceName : calledSourceNames) {
         ArazzoSourceLink link = links.get(sourceName);
         if (!link.linked()) {
            reasons.add("API " + link.apiName() + " " + link.apiVersion() + " not found");
         }
      }
      return new ArazzoWorkflowStatus(workflowId, reasons.isEmpty(), reasons);
   }

   private ArazzoSourceLink link(String sourceName, ArazzoSources overlay) {
      ServiceRef api = overlay.getSources().get(sourceName);
      boolean linked = serviceRepository.findByNameAndVersion(api.getName(), api.getVersion()) != null;
      return new ArazzoSourceLink(sourceName, api.getName(), api.getVersion(), linked);
   }

   private static ArazzoDescription read(JsonNode document) throws MockRepositoryImportException {
      try {
         return ArazzoDocumentReader.read(document);
      } catch (UnsupportedArazzoDocumentException uade) {
         throw new MockRepositoryImportException(uade.getMessage(), uade);
      }
   }

   private static JsonNode parse(String content) throws MockRepositoryImportException {
      try {
         return ObjectMapperFactory.getYamlObjectMapper().readTree(content);
      } catch (JsonProcessingException jpe) {
         throw new MockRepositoryImportException("Arazzo document cannot be parsed as YAML or JSON", jpe);
      }
   }
}
