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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Integration tests of reading the steps of an Arazzo workflow through its REST endpoint.
 * @author SebastienDegodez
 */
class ArazzoWorkflowControllerIT extends AbstractBaseIT {

   private static final String FIXTURES = "target/test-classes/io/github/microcks/service/arazzo/";

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Autowired
   private ArazzoSourcesRepository arazzoSourcesRepository;

   @AfterEach
   void deleteDocumentsAndOverlays() {
      arazzoDocumentRepository.deleteAll();
      arazzoSourcesRepository.deleteAll();
   }

   @Test
   void theStepsOfAWorkflowAreReadWithTheirOperationsDataFlowInputsAndOutputs() throws Exception {
      String documentId = pastryScenariosAreUploadedAndLinked();

      ResponseEntity<String> response = restTemplate
            .getForEntity("/api/arazzo/documents/" + documentId + "/workflows/readThenReprice", String.class);

      assertEquals(200, response.getStatusCode().value());
      JsonNode workflow = new ObjectMapper().readTree(response.getBody());
      assertEquals("readThenReprice [\"readThenReprice\",\"listThenReadFirst\"]",
            workflow.path("workflowId").asText() + " " + workflow.path("workflowIds"));
      assertEquals("GET /pastry/{name} GetPastryByName", operation(workflow.path("steps").path(0)));
      assertEquals("PATCH /pastry/{name} PatchPastry", operation(workflow.path("steps").path(1)));
      assertEquals("{\"fromStepId\":\"readPastry\",\"outputName\":\"name\",\"to\":{\"stepId\":\"reprice\","
            + "\"place\":\"path\",\"target\":\"name\"}}", workflow.path("dataPassings").path(0).toString());
      assertEquals(
            "newPrice [{\"stepId\":\"reprice\",\"place\":\"body\",\"target\":\"/price\"},"
                  + "{\"stepId\":\"reprice\",\"place\":\"criterion\"}]",
            workflow.path("inputs").path(1).path("name").asText() + " "
                  + workflow.path("inputs").path(1).path("usedBy"));
      assertEquals("{\"before\":\"$steps.readPastry.outputs.price\",\"after\":\"$steps.reprice.outputs.price\"}",
            workflow.path("outputs").toString());
   }

   @Test
   void aWorkflowTheDocumentDoesNotHaveIsNotFound() {
      String documentId = pastryScenariosAreUploadedAndLinked();

      ResponseEntity<String> response = restTemplate
            .getForEntity("/api/arazzo/documents/" + documentId + "/workflows/unknown", String.class);

      assertEquals(404, response.getStatusCode().value());
   }

   private String pastryScenariosAreUploadedAndLinked() {
      uploadArtifactFile(FIXTURES + "api-pastry-2.0.openapi.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry-scenarios.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo-sources.yaml", false);
      return arazzoDocumentRepository.findByTitleAndVersion("API Pastry scenarios", "1.0.0").getId();
   }

   private static String operation(JsonNode step) {
      JsonNode operation = step.path("operation");
      return operation.path("method").asText() + " " + operation.path("path").asText() + " "
            + operation.path("operationId").asText();
   }
}
