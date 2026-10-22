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

import io.github.microcks.domain.WorkflowRunCounts;
import io.github.microcks.domain.WorkflowRunStatus;
import io.github.microcks.domain.WorkflowRunSummary;
import io.github.microcks.domain.WorkflowRunTarget;
import io.github.microcks.repository.WorkflowRunFilter;
import io.github.microcks.service.ArazzoRunHistoryService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Endpoints reading the runs history of the workflows of an Arazzo document, newest first, filtered by workflow, target
 * and result.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoRunHistoryController {

   private final ArazzoRunHistoryService arazzoRunHistoryService;

   /**
    * Build a new ArazzoRunHistoryController with its dependencies.
    * @param arazzoRunHistoryService to read the runs history
    */
   public ArazzoRunHistoryController(ArazzoRunHistoryService arazzoRunHistoryService) {
      this.arazzoRunHistoryService = arazzoRunHistoryService;
   }

   @GetMapping(value = "/documents/{documentId}/runs")
   public List<WorkflowRunSummary> listRuns(@PathVariable("documentId") String documentId,
         @RequestParam(value = "workflow", required = false) String workflowId,
         @RequestParam(value = "target", required = false) WorkflowRunTarget target,
         @RequestParam(value = "result", required = false) WorkflowRunStatus result,
         @RequestParam(value = "page", required = false, defaultValue = "0") int page,
         @RequestParam(value = "size", required = false, defaultValue = "20") int size) {
      return arazzoRunHistoryService.getRuns(documentId, new WorkflowRunFilter(workflowId, target, result), page, size);
   }

   @GetMapping(value = "/documents/{documentId}/runs/count")
   public WorkflowRunCounts countRuns(@PathVariable("documentId") String documentId,
         @RequestParam(value = "workflow", required = false) String workflowId,
         @RequestParam(value = "target", required = false) WorkflowRunTarget target,
         @RequestParam(value = "result", required = false) WorkflowRunStatus result) {
      return arazzoRunHistoryService.countRuns(documentId, new WorkflowRunFilter(workflowId, target, result));
   }
}
