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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Walking skeleton of running an Arazzo workflow: from the webapp, through the Arazzo minion, to the Microcks mocks the
 * webapp serves, and back to the run stored by the webapp.
 * @author SebastienDegodez
 */
class ArazzoRunWalkingSkeletonIT extends AbstractBaseIT {

   private static final String FIXTURES = "target/test-classes/io/github/microcks/service/arazzo/";
   private static final ArazzoMinionProcess MINION = new ArazzoMinionProcess();
   private static final ObjectMapper JSON = new ObjectMapper();

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

   @AfterAll
   static void stopTheMinion() {
      MINION.stop();
   }

   @Test
   void readThenRepricePassesAgainstTheMocksOfApiPastry() throws Exception {
      uploadArtifactFile(FIXTURES + "api-pastry-2.0.openapi.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry-scenarios.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo-sources.yaml", false);
      String documentId = JSON.readTree(restTemplate.getForObject("/api/arazzo/documents", String.class)).get(0)
            .get("id").asText();

      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      ResponseEntity<String> launched = restTemplate.postForEntity(
            "/api/arazzo/documents/" + documentId + "/workflows/readThenReprice/runs",
            new HttpEntity<>("{\"inputs\": {\"pastry\": \"Eclair Cafe\", \"newPrice\": 2.6}, \"timeout\": 10000}",
                  headers),
            String.class);
      assertEquals(201, launched.getStatusCode().value(), launched.getBody());

      JsonNode run = awaitFinalRun(JSON.readTree(launched.getBody()).get("id").asText());

      assertEquals("SUCCESS", run.get("status").asText(), run.toPrettyString());
      List<String> steps = new ArrayList<>();
      run.get("steps").forEach(step -> steps
            .add(step.get("index").asInt() + " " + step.get("stepId").asText() + " " + step.get("status").asText()));
      assertEquals(List.of("0 readPastry PASSED", "1 reprice PASSED"), steps);
      assertEquals(JSON.readTree("{\"before\": 2.5, \"after\": 2.6}"), run.get("outputs"));
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
