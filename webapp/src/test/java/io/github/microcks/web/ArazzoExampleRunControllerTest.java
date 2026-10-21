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
import io.github.microcks.domain.ArazzoExampleLaunch;
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.service.ArazzoDocumentService;
import io.github.microcks.service.ArazzoRunService;
import io.github.microcks.service.ArtifactInfo;
import io.github.microcks.service.RecordingMinionClient;
import io.github.microcks.service.ServiceService;
import io.github.microcks.web.dto.ArazzoRunLaunchDTO;

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
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests of the endpoints playing the recorded examples of a workflow, as the run dialog and a CI call them, on the run
 * use case with the minion at its boundary.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class,
      ArazzoExampleRunControllerTest.MinionAtTheBoundary.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoExampleRunControllerTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";
   private static final String EXAMPLES = "examples.arazzo-sources.yaml";

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

   @Autowired
   private RecordingMinionClient minion;

   @Test
   void aRunNamingAnExamplePlaysItWithItsInputs() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosWithExamples("recorded");

      ResponseEntity<Object> launched = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of("pastry", "Ignored"), 10000L, null, null, null, "eclair-repriced"));

      WorkflowResult run = (WorkflowResult) launched.getBody();
      assertEquals(201, launched.getStatusCode().value());
      assertEquals("eclair-repriced", run.getExample().name());
      assertEquals(Map.of("pastry", "Eclair Cafe", "newPrice", 2.6), minion.requests().get(0).inputs());
   }

   @Test
   void aRunNamingAnUnknownExampleIsABadRequestWithItsReason() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosWithExamples("recorded");

      ResponseEntity<Object> refused = controller.launchRun(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(Map.of(), null, null, null, null, "eclair-flambe"));

      assertEquals(400, refused.getStatusCode().value());
      assertEquals("Workflow readThenReprice has no example eclair-flambe", refused.getBody());
   }

   @Test
   void runningAllExamplesAnswersHowEachRunWasLaunched() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosWithExamples("missing-input");

      ResponseEntity<Object> launched = controller.launchExampleRuns(document.getId(), "readThenReprice",
            new ArazzoRunLaunchDTO(null, 5000L, Map.of("pastryApi", "http://localhost:8080"), null, true, null));

      assertEquals(200, launched.getStatusCode().value());
      assertEquals(
            List.of("eclair-repriced 1 null", "millefeuille-repriced 2 null",
                  "eclair-without-price null Missing input: newPrice"),
            ((List<?>) launched.getBody()).stream().map(ArazzoExampleLaunch.class::cast)
                  .map(launch -> launch.example() + " " + launch.number() + " " + launch.refusal()).toList());
      assertEquals(List.of("http://localhost:8080 true 5000", "http://localhost:8080 true 5000"),
            minion.requests().stream().map(request -> request.sources().get("pastryApi").baseUrl() + " "
                  + request.validateSchema() + " " + request.timeoutMS()).toList());
   }

   @Test
   void runningAllExamplesOfAnUnknownDocumentIsNotFoundAndOfAnUnknownWorkflowIsABadRequest() throws Exception {
      ArazzoRunController controller = new ArazzoRunController(arazzoRunService);
      ArazzoDocument document = pastryScenariosWithExamples("recorded");

      assertEquals(404, controller.launchExampleRuns("unknown", "readThenReprice", new ArazzoRunLaunchDTO(null, null))
            .getStatusCode().value());
      ResponseEntity<Object> refused = controller.launchExampleRuns(document.getId(), "readTwice",
            new ArazzoRunLaunchDTO(null, null));
      assertEquals("400 text/plain Unknown workflow: readTwice",
            refused.getStatusCode().value() + " " + refused.getHeaders().getContentType() + " " + refused.getBody());
   }

   private ArazzoDocument pastryScenariosWithExamples(String overlay) throws Exception {
      File contract = new File(
            ArazzoExampleRunControllerTest.class.getResource(FIXTURES + "api-pastry-2.0.openapi.yaml").toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo("api-pastry-2.0.openapi.yaml", true));
      ArazzoDocument document = arazzoDocumentService.importArazzoDocument(fixture("pastry-scenarios.arazzo.yaml"));
      arazzoDocumentService.importArazzoSources(exampleOf(overlay));
      return document;
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoExampleRunControllerTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }

   private static String exampleOf(String example) throws IOException {
      String marker = "# example: " + example + " ";
      return Arrays.stream(fixture(EXAMPLES).split("\n---\n")).filter(document -> document.contains(marker)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException(example + " is not in " + EXAMPLES));
   }
}
