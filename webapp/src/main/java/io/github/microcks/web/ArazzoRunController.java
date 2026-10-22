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

import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.service.ArazzoRunImplementations;
import io.github.microcks.service.ArazzoRunRefusedException;
import io.github.microcks.service.ArazzoRunService;
import io.github.microcks.web.dto.ArazzoRunLaunchDTO;
import io.github.microcks.web.dto.ArazzoRunOutcomeDTO;
import io.github.microcks.web.dto.ArazzoStepReportDTO;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Optional;

/**
 * Endpoints running the workflows of Arazzo documents: launching a run, reading it, and receiving the reports of the
 * Arazzo minion executing it.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoRunController {

   private final ArazzoRunService arazzoRunService;

   /**
    * Build a new ArazzoRunController with its dependencies.
    * @param arazzoRunService to run workflows and record their runs
    */
   public ArazzoRunController(ArazzoRunService arazzoRunService) {
      this.arazzoRunService = arazzoRunService;
   }

   @PostMapping(value = "/documents/{documentId}/workflows/{workflowId}/runs")
   public ResponseEntity<Object> launchRun(@PathVariable("documentId") String documentId,
         @PathVariable("workflowId") String workflowId, @RequestBody ArazzoRunLaunchDTO launch) {
      try {
         Optional<WorkflowResult> run = arazzoRunService.launchRun(documentId, workflowId, launch.inputs(),
               launch.timeout(),
               launch.implementations() == null ? null
                     : new ArazzoRunImplementations(launch.implementations(), launch.secretName()),
               Boolean.TRUE.equals(launch.validateSchema()));
         return run.<ResponseEntity<Object>>map(
               launched -> ResponseEntity.created(URI.create("/api/arazzo/runs/" + launched.getId())).body(launched))
               .orElseGet(() -> ResponseEntity.notFound().build());
      } catch (ArazzoRunRefusedException arre) {
         return ResponseEntity.badRequest().body(arre.getMessage());
      }
   }

   @GetMapping(value = "/runs/{runId}")
   public ResponseEntity<WorkflowResult> getRun(@PathVariable("runId") String runId) {
      return ResponseEntity.of(arazzoRunService.getRun(runId));
   }

   @PostMapping(value = "/runs/{runId}/steps")
   public ResponseEntity<Void> reportStep(@PathVariable("runId") String runId,
         @RequestBody ArazzoStepReportDTO report) {
      return noContentOrNotFound(
            arazzoRunService.recordStep(runId, report.toStepResult(), report.toRequest(), report.toResponse()));
   }

   @PostMapping(value = "/runs/{runId}/outcome")
   public ResponseEntity<Void> reportOutcome(@PathVariable("runId") String runId,
         @RequestBody ArazzoRunOutcomeDTO outcome) {
      return noContentOrNotFound(arazzoRunService.recordOutcome(runId, outcome.runStatus(), outcome.outputs(),
            outcome.elapsedTime(), outcome.message()));
   }

   private static ResponseEntity<Void> noContentOrNotFound(Optional<WorkflowResult> run) {
      return run.isPresent() ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
   }
}
