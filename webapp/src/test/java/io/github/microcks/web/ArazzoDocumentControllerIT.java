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
import io.github.microcks.util.ObjectMapperFactory;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Integration tests of the endpoint listing the Arazzo documents for the Workflows page.
 * @author SebastienDegodez
 */
class ArazzoDocumentControllerIT extends AbstractBaseIT {

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
   void uploadedDocumentsAreListedWithTheirFileApisAndWorkflows() throws Exception {
      uploadArtifactFile(FIXTURES + "api-pastry-2.0.openapi.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo-sources.yaml", false);

      JsonNode documents = get("/api/arazzo/documents");

      assertEquals(1, documents.size());
      JsonNode document = documents.get(0);
      assertEquals("API Pastry scenarios 1.0.0 (pastry.arazzo.yaml)", document.path("title").asText() + " "
            + document.path("version").asText() + " (" + document.path("fileName").asText() + ")");
      assertEquals(arazzoDocumentRepository.findByTitleAndVersion("API Pastry scenarios", "1.0.0").getId(),
            document.path("id").asText());
      JsonNode source = document.path("sources").get(0);
      assertEquals("pastryApi -> REST API Pastry - 2.0 2.0.0: linked",
            source.path("link").path("sourceName").asText() + " -> " + source.path("apiType").asText() + " "
                  + source.path("link").path("apiName").asText() + " " + source.path("link").path("apiVersion").asText()
                  + ": " + (source.path("link").path("linked").asBoolean() ? "linked" : "not linked"));
      assertEquals(serviceRepository.findByNameAndVersion("API Pastry - 2.0", "2.0.0").getId(),
            source.path("apiId").asText());
      List<String> workflows = new ArrayList<>();
      for (JsonNode workflow : document.path("workflows")) {
         workflows.add(workflow.path("status").path("workflowId").asText() + ": " + workflow.path("stepCount").asInt()
               + " steps, runnable " + workflow.path("status").path("runnable").asBoolean() + ", "
               + workflow.path("lastResult").asText());
      }
      assertEquals(List.of("readThenReprice: 2 steps, runnable true, NEVER_RUN",
            "listThenReadFirst: 2 steps, runnable true, NEVER_RUN"), workflows);
   }

   @Test
   void theListCanBeFilteredByApi() throws Exception {
      uploadArtifactFile(FIXTURES + "order-fulfilment.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "order-fulfilment.arazzo-sources.yaml", false);
      uploadArtifactFile(FIXTURES + "pastry.arazzo.yaml", true);
      uploadArtifactFile(FIXTURES + "pastry.arazzo-sources.yaml", false);

      JsonNode documents = get("/api/arazzo/documents?api=API Pastry - 2.0");

      List<String> titles = new ArrayList<>();
      documents.forEach(document -> titles.add(document.path("title").asText()));
      assertEquals(List.of("API Pastry scenarios"), titles);
   }

   private JsonNode get(String path) throws Exception {
      ResponseEntity<String> response = restTemplate.getForEntity(path, String.class);
      assertEquals(200, response.getStatusCode().value());
      return ObjectMapperFactory.getJsonObjectMapper().readTree(response.getBody());
   }
}
