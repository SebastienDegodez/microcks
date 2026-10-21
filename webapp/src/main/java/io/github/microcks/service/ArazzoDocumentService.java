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
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.util.MockRepositoryImportException;
import io.github.microcks.util.ObjectMapperFactory;
import io.github.microcks.util.arazzo.ArazzoDescription;
import io.github.microcks.util.arazzo.ArazzoDocumentReader;
import io.github.microcks.util.arazzo.UnsupportedArazzoDocumentException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Service bean for common processing around Arazzo documents.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoDocumentService {

   private final ArazzoDocumentRepository arazzoDocumentRepository;

   /**
    * Build a new ArazzoDocumentService with its required dependencies.
    * @param arazzoDocumentRepository The repository of imported Arazzo documents
    */
   public ArazzoDocumentService(ArazzoDocumentRepository arazzoDocumentRepository) {
      this.arazzoDocumentRepository = arazzoDocumentRepository;
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
    * Import an Arazzo document so that its workflows are kept in Microcks.
    * @param content The document as uploaded, in YAML or JSON
    * @return The imported document
    * @throws MockRepositoryImportException if the document cannot be imported
    */
   public ArazzoDocument importArazzoDocument(String content) throws MockRepositoryImportException {
      ArazzoDescription description = read(parse(content));
      // Re-importing the same title and version updates the existing document.
      ArazzoDocument document = arazzoDocumentRepository.findByTitleAndVersion(description.title(),
            description.version());
      if (document == null) {
         document = new ArazzoDocument();
      }
      document.setTitle(description.title());
      document.setVersion(description.version());
      document.setWorkflowIds(description.workflowIds());
      document.setContent(content);
      return arazzoDocumentRepository.save(document);
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
