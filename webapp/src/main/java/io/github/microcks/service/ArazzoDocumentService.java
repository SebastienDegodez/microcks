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
import io.github.microcks.domain.ArazzoStepCall;
import io.github.microcks.domain.ArazzoStepOperation;
import io.github.microcks.domain.ArazzoWorkflowStatus;
import io.github.microcks.domain.Resource;
import io.github.microcks.domain.ResourceType;
import io.github.microcks.domain.Service;
import io.github.microcks.domain.ServiceRef;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.ArazzoSourcesRepository;
import io.github.microcks.repository.ResourceRepository;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.util.MockRepositoryImportException;
import io.github.microcks.util.ObjectMapperFactory;
import io.github.microcks.util.arazzo.ArazzoDescription;
import io.github.microcks.util.arazzo.ArazzoDocumentReader;
import io.github.microcks.util.arazzo.ArazzoOperationCall;
import io.github.microcks.util.arazzo.UnsupportedArazzoDocumentException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Service bean for common processing around Arazzo documents.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoDocumentService {

   private static final String ARAZZO_SOURCES_KIND = "ArazzoSources";
   private static final String NO_API_NAME_AND_VERSION = "no API name and version for this source";

   private final ArazzoDocumentRepository arazzoDocumentRepository;
   private final ArazzoSourcesRepository arazzoSourcesRepository;
   private final ServiceRepository serviceRepository;
   private final ResourceRepository resourceRepository;

   /**
    * Build a new ArazzoDocumentService with its required dependencies.
    * @param arazzoDocumentRepository The repository of imported Arazzo documents
    * @param arazzoSourcesRepository  The repository of imported ArazzoSources overlays
    * @param serviceRepository        The repository of the APIs the source descriptions are linked to
    * @param resourceRepository       The repository of the contracts that define the operations of these APIs
    */
   public ArazzoDocumentService(ArazzoDocumentRepository arazzoDocumentRepository,
         ArazzoSourcesRepository arazzoSourcesRepository, ServiceRepository serviceRepository,
         ResourceRepository resourceRepository) {
      this.arazzoDocumentRepository = arazzoDocumentRepository;
      this.arazzoSourcesRepository = arazzoSourcesRepository;
      this.serviceRepository = serviceRepository;
      this.resourceRepository = resourceRepository;
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
      document.setWorkflowCalls(stepCalls(ArazzoDocumentReader.workflowCalls(parsed)));
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
      String name = overlay.path("metadata").path("name").asText();
      String version = overlay.path("metadata").path("version").asText();
      // Re-importing the same name and version replaces the existing overlay.
      ArazzoSources arazzoSources = arazzoSourcesRepository.findByNameAndVersion(name, version);
      if (arazzoSources == null) {
         arazzoSources = new ArazzoSources();
      }
      arazzoSources.setName(name);
      arazzoSources.setVersion(version);
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
      return resolveSources(arazzoDocumentRepository.findByTitleAndVersion(title, version)).values().stream()
            .map(ResolvedSource::link).toList();
   }

   /**
    * Tell, for each workflow of an Arazzo document, whether it can run against the APIs of Microcks.
    * @param title   The title of the Arazzo document
    * @param version The version of the Arazzo document
    * @return The status of each workflow, in the order of the document
    */
   public List<ArazzoWorkflowStatus> getWorkflowStatuses(String title, String version) {
      ArazzoDocument document = arazzoDocumentRepository.findByTitleAndVersion(title, version);
      Map<String, ResolvedSource> sources = resolveSources(document);
      return document.getWorkflowIds().stream()
            .map(workflowId -> status(workflowId, document.getWorkflowCalls().get(workflowId), sources)).toList();
   }

   /**
    * A workflow is runnable when each of its steps calls an operation found in a linked API; else these are the
    * reasons, in the order of the steps, each given once.
    */
   private static ArazzoWorkflowStatus status(String workflowId, List<ArazzoStepCall> calls,
         Map<String, ResolvedSource> sources) {
      Set<String> reasons = new LinkedHashSet<>();
      for (ArazzoStepCall call : calls) {
         String reason = operationOf(call, sources).reason();
         if (reason != null) {
            reasons.add(reason);
         }
      }
      return new ArazzoWorkflowStatus(workflowId, reasons.isEmpty(), List.copyOf(reasons));
   }

   /**
    * @param call    The operation a step calls
    * @param sources The source descriptions of the document, resolved
    * @return The operation found in the linked API, or why it is not found
    */
   static ArazzoStepOperation operationOf(ArazzoStepCall call, Map<String, ResolvedSource> sources) {
      ResolvedSource source = sources.get(call.sourceName());
      ArazzoSourceLink link = source.link();
      if (link.apiName() == null) {
         return notFound(call, NO_API_NAME_AND_VERSION);
      }
      if (!link.linked()) {
         return notFound(call, "API " + link.apiName() + " " + link.apiVersion() + " not found");
      }
      ArazzoStepOperation operation = source.operations().get(call.operationId());
      if (operation == null) {
         return notFound(call,
               "Operation " + call.operationId() + " not found in " + link.apiName() + " " + link.apiVersion());
      }
      return operation;
   }

   private static ArazzoStepOperation notFound(ArazzoStepCall call, String reason) {
      return new ArazzoStepOperation(call.sourceName(), call.operationId(), null, null, reason);
   }

   /** Resolve each source description of a document, in the order of the document. */
   Map<String, ResolvedSource> resolveSources(ArazzoDocument document) {
      ArazzoSources overlay = arazzoSourcesRepository.findByNameAndVersion(document.getTitle(), document.getVersion());
      Map<String, ResolvedSource> sources = new LinkedHashMap<>();
      for (String sourceName : document.getSourceNames()) {
         sources.put(sourceName, resolve(sourceName, overlay));
      }
      return sources;
   }

   private ResolvedSource resolve(String sourceName, ArazzoSources overlay) {
      ServiceRef api = overlay == null ? null : overlay.getSources().get(sourceName);
      if (api == null) {
         return new ResolvedSource(new ArazzoSourceLink(sourceName, null, null, false), Map.of());
      }
      Service service = serviceRepository.findByNameAndVersion(api.getName(), api.getVersion());
      if (service == null) {
         return new ResolvedSource(new ArazzoSourceLink(sourceName, api.getName(), api.getVersion(), false), Map.of());
      }
      return new ResolvedSource(new ArazzoSourceLink(sourceName, api.getName(), api.getVersion(), true),
            definedOperations(sourceName, service));
   }

   /** An API defines the operations whose operationId appears in the main OpenAPI contract Microcks stored for it. */
   private Map<String, ArazzoStepOperation> definedOperations(String sourceName, Service service) {
      Map<String, ArazzoStepOperation> operations = new HashMap<>();
      for (Resource resource : resourceRepository.findMainByServiceId(service.getId())) {
         if (resource.getType() == ResourceType.OPEN_API_SPEC) {
            operations.putAll(openApiOperations(sourceName, resource.getContent()));
         }
      }
      return operations;
   }

   private static Map<String, ArazzoStepOperation> openApiOperations(String sourceName, String contract) {
      Map<String, ArazzoStepOperation> operations = new HashMap<>();
      for (Map.Entry<String, JsonNode> pathItem : readContract(contract).path("paths").properties()) {
         for (Map.Entry<String, JsonNode> operation : pathItem.getValue().properties()) {
            if (operation.getValue().has("operationId")) {
               String operationId = operation.getValue().path("operationId").asText();
               operations.put(operationId, new ArazzoStepOperation(sourceName, operationId,
                     operation.getKey().toUpperCase(Locale.ROOT), pathItem.getKey(), null));
            }
         }
      }
      return operations;
   }

   private static JsonNode readContract(String contract) {
      try {
         return ObjectMapperFactory.getYamlObjectMapper().readTree(contract);
      } catch (JsonProcessingException jpe) {
         // A contract that cannot be read defines no operation.
         return MissingNode.getInstance();
      }
   }

   private static Map<String, List<ArazzoStepCall>> stepCalls(Map<String, List<ArazzoOperationCall>> workflowCalls) {
      Map<String, List<ArazzoStepCall>> stepCalls = new HashMap<>();
      workflowCalls.forEach((workflowId, calls) -> stepCalls.put(workflowId,
            calls.stream().map(call -> new ArazzoStepCall(call.sourceName(), call.operationId())).toList()));
      return stepCalls;
   }

   /** A source description with its link and the operations the linked API defines, by operationId. */
   record ResolvedSource(ArazzoSourceLink link, Map<String, ArazzoStepOperation> operations) {
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
