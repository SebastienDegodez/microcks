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
package io.github.microcks.web;

import io.github.microcks.domain.ArazzoApiUsage;
import io.github.microcks.domain.ArazzoWorkflowDetail;
import io.github.microcks.service.ArazzoWorkflowService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A Rest controller for the workflows of imported Arazzo documents.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoWorkflowController {

   private final ArazzoWorkflowService arazzoWorkflowService;

   /**
    * Build a new ArazzoWorkflowController with its dependencies.
    * @param arazzoWorkflowService to read the workflows of Arazzo documents
    */
   public ArazzoWorkflowController(ArazzoWorkflowService arazzoWorkflowService) {
      this.arazzoWorkflowService = arazzoWorkflowService;
   }

   @GetMapping(value = "/documents/{documentId}/workflows/{workflowId}")
   public ResponseEntity<ArazzoWorkflowDetail> getWorkflowDetail(@PathVariable("documentId") String documentId,
         @PathVariable("workflowId") String workflowId) {
      return ResponseEntity.of(arazzoWorkflowService.getWorkflowDetail(documentId, workflowId));
   }

   /**
    * Tell which workflows use an API, and how many workflows call each of its operations, for the page of this API.
    * @param serviceId The id of the API
    * @return The workflows using the API, by document, with the number of workflows calling each of its operations
    */
   @GetMapping(value = "/services/{serviceId}/workflows")
   public ArazzoApiUsage getApiUsage(@PathVariable("serviceId") String serviceId) {
      return arazzoWorkflowService.getApiUsage(serviceId);
   }
}
