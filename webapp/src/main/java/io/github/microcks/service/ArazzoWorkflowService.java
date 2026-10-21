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
import io.github.microcks.domain.ArazzoStepCall;
import io.github.microcks.domain.ArazzoStepCriterion;
import io.github.microcks.domain.ArazzoStepDetail;
import io.github.microcks.domain.ArazzoStepParameter;
import io.github.microcks.domain.ArazzoStepRequestBody;
import io.github.microcks.domain.ArazzoWorkflowDetail;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.service.ArazzoDocumentService.ResolvedSource;
import io.github.microcks.util.ObjectMapperFactory;
import io.github.microcks.util.arazzo.ArazzoRequestBody;
import io.github.microcks.util.arazzo.ArazzoStep;
import io.github.microcks.util.arazzo.ArazzoWorkflow;
import io.github.microcks.util.arazzo.ArazzoWorkflowReader;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service bean reading the workflows of imported Arazzo documents.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoWorkflowService {

   private final ArazzoDocumentRepository arazzoDocumentRepository;
   private final ArazzoDocumentService arazzoDocumentService;

   /**
    * Build a new ArazzoWorkflowService with its required dependencies.
    * @param arazzoDocumentRepository The repository of imported Arazzo documents
    * @param arazzoDocumentService    The service linking the source descriptions of a document to Microcks APIs
    */
   public ArazzoWorkflowService(ArazzoDocumentRepository arazzoDocumentRepository,
         ArazzoDocumentService arazzoDocumentService) {
      this.arazzoDocumentRepository = arazzoDocumentRepository;
      this.arazzoDocumentService = arazzoDocumentService;
   }

   /**
    * Read a workflow of an Arazzo document: its steps, the operations they call, and how data flows between them.
    * @param documentId The id of the Arazzo document
    * @param workflowId The id of the workflow in that document
    * @return The workflow, empty if the document or the workflow does not exist
    */
   public Optional<ArazzoWorkflowDetail> getWorkflowDetail(String documentId, String workflowId) {
      return arazzoDocumentRepository.findById(documentId).flatMap(document -> ArazzoWorkflowReader
            .workflow(parse(document.getContent()), workflowId).map(workflow -> detail(document, workflow)));
   }

   private ArazzoWorkflowDetail detail(ArazzoDocument document, ArazzoWorkflow workflow) {
      Map<String, ResolvedSource> sources = arazzoDocumentService.resolveSources(document);
      return new ArazzoWorkflowDetail(document.getId(), document.getTitle(), document.getVersion(),
            document.getWorkflowIds(), sources.values().stream().map(ResolvedSource::link).toList(),
            workflow.workflowId(), workflow.summary(), workflow.description(), List.of(),
            workflow.steps().stream().map(step -> step(step, sources)).toList(), workflow.outputs(), List.of());
   }

   private static ArazzoStepDetail step(ArazzoStep step, Map<String, ResolvedSource> sources) {
      return new ArazzoStepDetail(step.stepId(), step.description(),
            ArazzoDocumentService.operationOf(new ArazzoStepCall(step.call().sourceName(), step.call().operationId()),
                  sources),
            step.parameters().stream().map(
                  parameter -> new ArazzoStepParameter(parameter.name(), parameter.in(), parameter.value())).toList(),
            requestBody(step.requestBody()),
            step.successCriteria().stream().map(
                  criterion -> new ArazzoStepCriterion(criterion.condition(), criterion.context(), criterion.type()))
                  .toList(),
            step.outputs());
   }

   private static ArazzoStepRequestBody requestBody(ArazzoRequestBody requestBody) {
      if (requestBody == null) {
         return null;
      }
      return new ArazzoStepRequestBody(requestBody.contentType(), requestBody.payload(), requestBody.replacements());
   }

   private static JsonNode parse(String content) {
      try {
         return ObjectMapperFactory.getYamlObjectMapper().readTree(content);
      } catch (JsonProcessingException jpe) {
         // A stored document that cannot be read has no workflow.
         return MissingNode.getInstance();
      }
   }
}
