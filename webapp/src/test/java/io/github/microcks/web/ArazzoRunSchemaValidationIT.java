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

import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.ArazzoSourcesRepository;
import io.github.microcks.repository.WorkflowResultRepository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Running an Arazzo workflow with its responses validated against their OpenAPI schema, from the webapp, through the
 * Arazzo minion, to Microcks mocks whose PatchPastry example does not conform to the Pastry schema, and back. The
 * examples are in {@code schema-validation.yaml}.
 * @author SebastienDegodez
 */
class ArazzoRunSchemaValidationIT extends AbstractBaseIT {

   private static final Path FIXTURE = Path
         .of("target/test-classes/io/github/microcks/service/arazzo/" + "schema-validation.yaml");
   private static final Path UPLOADS = Path.of("target/schema-validation");
   private static final ArazzoMinionProcess MINION = new ArazzoMinionProcess();
   private static final ObjectMapper JSON = new ObjectMapper();

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Autowired
   private ArazzoSourcesRepository arazzoSourcesRepository;

   @Autowired
   private WorkflowResultRepository workflowResultRepository;

   @DynamicPropertySource
   static void minionUrl(DynamicPropertyRegistry registry) {
      registry.add("arazzo-minion.url", MINION::url);
   }

   @BeforeEach
   void startTheMinionAgainstThisWebapp() throws Exception {
      if (!MINION.isStarted()) {
         MINION.start(getServerUrl());
      }
   }

   @AfterEach
   void deleteDocumentsAndRuns() {
      arazzoDocumentRepository.deleteAll();
      arazzoSourcesRepository.deleteAll();
      workflowResultRepository.deleteAll();
   }

   @AfterAll
   static void stopTheMinion() {
      MINION.stop();
   }

   @ParameterizedTest
   @CsvSource(delimiter = '|', value = {
         "true  | FAILURE | 0 readPastry PASSED; 1 reprice FAILED /price does not match the Pastry schema: "
               + "string found, number expected",
         "false | SUCCESS | 0 readPastry PASSED; 1 reprice PASSED" })
   void aNonConformantResponseOfTheMocksFailsItsStepOnlyWhenTheResponsesAreValidated(boolean validateSchema,
         String status, String steps) throws Exception {
      upload("api-pastry-non-conformant", true);
      upload("pastry-journeys", true);
      upload("pastry-journeys-sources", false);
      String documentId = null;
      for (JsonNode document : JSON.readTree(restTemplate.getForObject("/api/arazzo/documents", String.class))) {
         if ("API Pastry journeys".equals(document.get("title").asText())) {
            documentId = document.get("id").asText();
         }
      }

      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      ResponseEntity<String> launched = restTemplate.postForEntity(
            "/api/arazzo/documents/" + documentId + "/workflows/readThenReprice/runs",
            new HttpEntity<>("{\"inputs\": {\"pastry\": \"Eclair Cafe\", \"newPrice\": 2.6}, \"timeout\": 10000, "
                  + "\"validateSchema\": " + validateSchema + "}", headers),
            String.class);
      assertEquals(201, launched.getStatusCode().value(), launched.getBody());

      JsonNode run = awaitFinalRun(JSON.readTree(launched.getBody()).get("id").asText());

      assertEquals(status, run.get("status").asText(), run.toPrettyString());
      assertEquals(validateSchema, run.get("validateSchema").asBoolean());
      List<String> described = new ArrayList<>();
      run.get("steps").forEach(step -> described.add((step.get("index").asInt() + " " + step.get("stepId").asText()
            + " " + step.get("status").asText() + " " + step.path("message").asText("")).trim()));
      assertEquals(Arrays.asList(steps.split("; ")), described);
   }

   /** Upload an example of the fixture as an artifact of its own. */
   private void upload(String example, boolean mainArtifact) throws Exception {
      String marker = "# example: " + example + " ";
      String document = Arrays.stream(Files.readString(FIXTURE, StandardCharsets.UTF_8).split("\n---\n"))
            .filter(candidate -> candidate.startsWith(marker)).findFirst().orElseThrow();
      Files.createDirectories(UPLOADS);
      Path file = UPLOADS.resolve(example + ".yaml");
      Files.writeString(file, document.substring(document.indexOf('\n') + 1), StandardCharsets.UTF_8);
      uploadArtifactFile(file.toString(), mainArtifact);
   }

   private JsonNode awaitFinalRun(String runId) throws Exception {
      JsonNode run = null;
      for (int attempt = 0; attempt < 100; attempt++) {
         run = JSON.readTree(restTemplate.getForObject("/api/arazzo/runs/" + runId, String.class));
         if (!"IN_PROGRESS".equals(run.get("status").asText())) {
            return run;
         }
         Thread.sleep(200);
      }
      return run;
   }
}
