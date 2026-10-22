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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.URI;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Integration tests of the Mock URL of an Arazzo workflow, end to end: an application posts the inputs of a workflow,
 * the webapp has the Arazzo minion play it on the Microcks mocks it serves, and answers with its outputs or why it
 * failed; the run is stored with the Mock URL as its origin.
 * @author SebastienDegodez
 */
class ArazzoWorkflowMockUrlIT extends AbstractBaseIT {

   private static final String FIXTURES = "target/test-classes/io/github/microcks/service/arazzo/";
   private static final String PASTRY_SCENARIOS = "/arazzo/API+Pastry+scenarios/1.0.0/";
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
   void pastryScenariosAreUploadedAndLinked() throws Exception {
      if (!MINION.isStarted()) {
         MINION.start(getServerUrl());
      }
      uploadArtifactFile(FIXTURES + "api-pastry-2.0.openapi.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry-scenarios.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo-sources.yaml", false);
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

   /**
    * AC-02 and AC-05, domain example 1: the workflow is played on the mocks, the answer is exactly its outputs, and the
    * run is stored and listed with the Mock URL as its origin.
    */
   @Test
   void theWorkflowIsPlayedOnTheMocksAndAnswersExactlyItsOutputs() throws Exception {
      ResponseEntity<String> answer = post(PASTRY_SCENARIOS + "readThenReprice",
            "{\"pastry\": \"Eclair Cafe\", \"newPrice\": 2.6}");

      assertEquals(200, answer.getStatusCode().value(), answer.getBody());
      assertEquals(MediaType.APPLICATION_JSON, answer.getHeaders().getContentType());
      assertEquals(JSON.readTree("{\"before\": 2.5, \"after\": 2.6}"), JSON.readTree(answer.getBody()));
      String runId = answer.getHeaders().getFirst("X-Microcks-Arazzo-Run-Id");
      JsonNode run = JSON.readTree(restTemplate.getForObject("/api/arazzo/runs/" + runId, String.class));
      assertEquals("SUCCESS MOCKS MOCK_URL",
            run.get("status").asText() + " " + run.get("target").asText() + " " + run.get("origin").asText());
      JsonNode history = JSON.readTree(restTemplate
            .getForObject("/api/arazzo/documents/" + run.get("documentId").asText() + "/runs", String.class));
      assertEquals(runId + " MOCK_URL",
            history.get(0).get("id").asText() + " " + history.get(0).get("origin").asText());
   }

   /**
    * AC-03, domain example 3: a step whose mock answers an error status fails the call with that status (the mocks of
    * API Pastry answer 400 to readFirst, as they lack the example of Baba Rhum), any other failing step with 502,
    * naming the run and the step.
    */
   @ParameterizedTest
   @CsvSource(delimiter = ';', value = {
         "listThenReadFirst; ''; 400; readFirst; Step readFirst failed: unmet success criteria $statusCode == 200",
         "readThenReprice; {\"pastry\": \"Eclair Cafe\", \"newPrice\": 3.1}; 502; reprice; Step reprice failed: unmet "
               + "success criteria $response.body#/price == $inputs.newPrice" })
   void aFailingStepFailsTheCallWithTheStatusOfItsMockOr502(String workflowId, String inputs, int status,
         String failedStep, String reason) throws Exception {
      ResponseEntity<String> answer = post(PASTRY_SCENARIOS + workflowId, inputs);

      JsonNode failure = JSON.readTree(answer.getBody());
      assertEquals(status + " " + failedStep + " " + reason, answer.getStatusCode().value() + " "
            + failure.path("failedStep").asText() + " " + failure.path("reason").asText(), answer.getBody());
      assertEquals(answer.getHeaders().getFirst("X-Microcks-Arazzo-Run-Id"), failure.path("runId").asText());
      assertEquals("FAILURE",
            JSON.readTree(restTemplate.getForObject("/api/arazzo/runs/" + failure.path("runId").asText(), String.class))
                  .get("status").asText());
   }

   /**
    * AC-03 and AC-04, domain examples 2 and 4: missing or invalid inputs are refused with 400, an unknown document or
    * workflow with 404, with the reason, and nothing runs.
    */
   @ParameterizedTest
   @CsvSource(delimiter = ';', value = {
         "/arazzo/API+Pastry+scenarios/1.0.0/readThenReprice; {\"pastry\": \"Eclair Cafe\"}; 400; Missing input: "
               + "newPrice",
         "/arazzo/API+Pastry+scenarios/1.0.0/readThenReprice; [1, 2]; 400; The inputs must be a JSON object",
         "/arazzo/API+Pastry+scenarios/1.0.0/deleteAll; {}; 404; Unknown workflow: deleteAll",
         "/arazzo/API%20Pastry%20scenarios/9.9.9/readThenReprice; {}; 404; Unknown Arazzo document: API Pastry "
               + "scenarios 9.9.9" })
   void aRefusedCallAnswersTheReasonAndNothingRuns(String path, String inputs, int status, String reason)
         throws Exception {
      ResponseEntity<String> answer = post(path, inputs);

      assertEquals(status + " {\"reason\":\"" + reason + "\"}",
            answer.getStatusCode().value() + " " + answer.getBody());
      assertEquals(0, workflowResultRepository.count());
   }

   /** Same CORS policy as the other mock endpoints: a browser application may post to the Mock URL. */
   @Test
   void aBrowserMayPostToTheMockUrl() {
      HttpHeaders headers = new HttpHeaders();
      headers.set(HttpHeaders.ORIGIN, "http://underwriting-ui");
      headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST");
      headers.set(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type");

      ResponseEntity<String> preflight = restTemplate.exchange(new RequestEntity<>(headers, HttpMethod.OPTIONS,
            URI.create(getServerUrl() + PASTRY_SCENARIOS + "readThenReprice")), String.class);

      assertEquals("200 http://underwriting-ui", preflight.getStatusCode().value() + " "
            + preflight.getHeaders().getFirst(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
   }

   private ResponseEntity<String> post(String path, String inputs) {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      return restTemplate.exchange(
            new RequestEntity<>(inputs, headers, HttpMethod.POST, URI.create(getServerUrl() + path)), String.class);
   }
}
