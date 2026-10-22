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

import io.github.microcks.domain.ArazzoExampleLaunch;
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.service.ArazzoRunImplementations;
import io.github.microcks.service.ArazzoRunRefusedException;
import io.github.microcks.service.ArazzoRunService;
import io.github.microcks.web.dto.ArazzoRunLaunchDTO;
import io.github.microcks.web.dto.ArazzoRunOutcomeDTO;
import io.github.microcks.web.dto.ArazzoStepReportDTO;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
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
         Optional<WorkflowResult> run = launch.example() == null
               ? arazzoRunService.launchRun(documentId, workflowId, launch.inputs(), launch.timeout(),
                     implementationsOf(launch), Boolean.TRUE.equals(launch.validateSchema()))
               : arazzoRunService.launchExampleRun(documentId, workflowId, launch.example(), launch.timeout(),
                     implementationsOf(launch), Boolean.TRUE.equals(launch.validateSchema()));
         return run.<ResponseEntity<Object>>map(
               launched -> ResponseEntity.created(URI.create("/api/arazzo/runs/" + launched.getId())).body(launched))
               .orElseGet(() -> ResponseEntity.notFound().build());
      } catch (ArazzoRunRefusedException arre) {
         // The reason is plain text, whatever the client accepts, as the Microcks API describes it.
         return ResponseEntity.badRequest().contentType(MediaType.TEXT_PLAIN).body(arre.getMessage());
      }
   }

   /**
    * Play every recorded example of a workflow, one run per example, as a CI does in one call.
    * @param documentId The id of the Arazzo document
    * @param workflowId The id of the workflow in that document
    * @param launch     What the runs target and how; its inputs and example are not used
    * @return How the run of each example was launched, in the order of the examples; the reason in plain text when the
    *         workflow is unknown
    */
   @PostMapping(value = "/documents/{documentId}/workflows/{workflowId}/examples/runs")
   public ResponseEntity<Object> launchExampleRuns(@PathVariable("documentId") String documentId,
         @PathVariable("workflowId") String workflowId, @RequestBody ArazzoRunLaunchDTO launch) {
      try {
         Optional<List<ArazzoExampleLaunch>> launches = arazzoRunService.launchExampleRuns(documentId, workflowId,
               launch.timeout(), implementationsOf(launch), Boolean.TRUE.equals(launch.validateSchema()));
         return launches.<ResponseEntity<Object>>map(ResponseEntity::ok)
               .orElseGet(() -> ResponseEntity.notFound().build());
      } catch (ArazzoRunRefusedException arre) {
         return ResponseEntity.badRequest().contentType(MediaType.TEXT_PLAIN).body(arre.getMessage());
      }
   }

   /** The implementations a launch targets; null for the mocks. */
   private static ArazzoRunImplementations implementationsOf(ArazzoRunLaunchDTO launch) {
      return launch.implementations() == null ? null
            : new ArazzoRunImplementations(launch.implementations(), launch.secretName());
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
