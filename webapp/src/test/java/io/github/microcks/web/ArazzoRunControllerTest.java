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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.domain.WorkflowRunStatus;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.service.ArazzoDocumentService;
import io.github.microcks.service.ArazzoRunService;
import io.github.microcks.service.ArtifactInfo;
import io.github.microcks.service.RecordingMinionClient;
import io.github.microcks.service.ServiceService;
import io.github.microcks.web.dto.ArazzoRunLaunchDTO;
import io.github.microcks.web.dto.ArazzoRunOutcomeDTO;
import io.github.microcks.web.dto.ArazzoStepReportDTO;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.ResponseEntity;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests of the run endpoints as the UI and the Arazzo minion call them, on the run use case with the minion at its
 * boundary.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class, ArazzoRunControllerTest.MinionAtTheBoundary.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoRunControllerTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";
   private static final ObjectMapper JSON = new ObjectMapper();

   @TestConfiguration
   static class MinionAtTheBoundary {

      @Bean
      @Primary
      RecordingMinionClient recordingMinionClient() {
         return new RecordingMinionClient();
      }
   }

   @Autowired
   private ArazzoRunService arazzoRunService;

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ServiceService serviceService;

   @Test
   void aLaunchedRunIsCreatedAtItsUrlThenRecordedAsTheMinionReportsIt() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-scenarios.arazzo.yaml");

      ResponseEntity<Object> launched = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of("pastry", "Eclair Cafe", "newPrice", 2.6), 10000L));

      WorkflowResult run = (WorkflowResult) launched.getBody();
      assertEquals(201, launched.getStatusCode().value());
      assertEquals(URI.create("/api/arazzo/runs/" + run.getId()), launched.getHeaders().getLocation());
      assertEquals(204, controller.reportStep(run.getId(), contract("passedStep", ArazzoStepReportDTO.class))
            .getStatusCode().value());
      assertEquals(204, controller.reportOutcome(run.getId(), contract("runOutcome", ArazzoRunOutcomeDTO.class))
            .getStatusCode().value());
      WorkflowResult reported = controller.getRun(run.getId()).getBody();
      assertEquals(WorkflowRunStatus.SUCCESS, reported.getStatus());
      assertEquals("readPastry " + run.getId() + "-0",
            reported.getSteps().get(0).stepId() + " " + reported.getSteps().get(0).testCaseId());
   }

   @Test
   void aWorkflowThatCannotRunIsABadRequestWithItsReason() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-delete.arazzo.yaml");

      ResponseEntity<Object> refused = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of(), null));

      assertEquals(400, refused.getStatusCode().value());
      assertEquals("Workflow readThenReprice cannot run: Operation DeletePastry not found in API Pastry - 2.0 2.0.0",
            refused.getBody());
   }

   /** S8: a run missing an input is a bad request naming the input. */
   @Test
   void aRunMissingAnInputIsABadRequestNamingIt() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-scenarios.arazzo.yaml");

      ResponseEntity<Object> refused = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of("pastry", "Eclair Cafe"), null));

      assertEquals(400, refused.getStatusCode().value());
      assertEquals("Missing input: newPrice", refused.getBody());
   }

   @Test
   void anUnknownWorkflowOrRunIsNotFound() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-scenarios.arazzo.yaml");

      assertEquals(404, controller.launchRun(document.getId(), "unknown", new ArazzoRunLaunchDTO(Map.of(), null))
            .getStatusCode().value());
      assertEquals(404, controller.getRun("unknown").getStatusCode().value());
      assertEquals(404, controller.reportStep("unknown", contract("passedStep", ArazzoStepReportDTO.class))
            .getStatusCode().value());
      assertEquals(404, controller.reportOutcome("unknown", contract("runOutcome", ArazzoRunOutcomeDTO.class))
            .getStatusCode().value());
   }

   @Test
   void aRunIsLaunchedAgainstTheImplementationsGivenForItsSources() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-scenarios.arazzo.yaml");

      ResponseEntity<Object> launched = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of("pastry", "Eclair Cafe", "newPrice", 2.6), null,
                  Map.of("pastryApi", "http://localhost:8080"), null));

      WorkflowResult run = (WorkflowResult) launched.getBody();
      assertEquals(201, launched.getStatusCode().value());
      assertEquals("IMPLEMENTATIONS pastryApi http://localhost:8080",
            run.getTarget() + " " + run.getSources().get(0).sourceName() + " " + run.getSources().get(0).baseUrl());
   }

   @Test
   void aRunWithAnUnknownSecretIsABadRequestWithItsReason() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosAreImported("pastry-scenarios.arazzo.yaml");

      ResponseEntity<Object> refused = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of("pastry", "Eclair Cafe", "newPrice", 2.6), null,
                  Map.of("pastryApi", "http://localhost:8080"), "unknown-secret"));

      assertEquals(400, refused.getStatusCode().value());
      assertEquals("Secret 'unknown-secret' not found. Please ensure the secret exists before running the workflow.",
            refused.getBody());
   }

   private static <T> T contract(String part, Class<T> type) throws IOException {
      return JSON.treeToValue(ArazzoMinionContractTest.contract().get(part), type);
   }

   private ArazzoDocument pastryScenariosAreImported(String fixture) throws Exception {
      File contract = new File(
            ArazzoRunControllerTest.class.getResource(FIXTURES + "api-pastry-2.0.openapi.yaml").toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo("api-pastry-2.0.openapi.yaml", true));
      arazzoDocumentService.importArazzoSources(fixture("pastry.arazzo-sources.yaml"));
      return arazzoDocumentService.importArazzoDocument(fixture(fixture));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoRunControllerTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }
}
