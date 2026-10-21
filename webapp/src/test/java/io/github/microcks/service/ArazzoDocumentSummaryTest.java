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
package io.github.microcks.service;

import io.github.microcks.domain.ArazzoDocumentSummary;
import io.github.microcks.domain.ArazzoSourceLink;
import io.github.microcks.domain.ArazzoSourceSummary;
import io.github.microcks.domain.ArazzoWorkflowStatus;
import io.github.microcks.domain.ArazzoWorkflowSummary;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.repository.ServiceRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Acceptance tests of the list of Arazzo documents the Workflows page shows, one per acceptance criterion of the story.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = RepositoryTestsConfiguration.class)
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoDocumentSummaryTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ServiceService serviceService;

   @Autowired
   private ServiceRepository serviceRepository;

   @Test
   void documentsAreListedWithTheirWorkflowsApisAndLastResult() throws Exception {
      apiIsImported("api-pastry-2.0.openapi.yaml");
      arazzoDocumentService.importArazzoDocument(fixture("pastry.arazzo.yaml"), "pastry.arazzo.yaml");
      arazzoDocumentService.importArazzoSources(fixture("pastry.arazzo-sources.yaml"));

      List<ArazzoDocumentSummary> documents = arazzoDocumentService.getDocumentSummaries(null);

      assertEquals(List.of("API Pastry scenarios 1.0.0 (pastry.arazzo.yaml)"),
            documents.stream().map(ArazzoDocumentSummaryTest::describe).toList());
      assertEquals(List.of("pastryApi -> REST API Pastry - 2.0 2.0.0: linked"), sources(documents.get(0)));
      assertEquals(serviceRepository.findByNameAndVersion("API Pastry - 2.0", "2.0.0").getId(),
            documents.get(0).sources().get(0).apiId());
      assertEquals(
            List.of("readThenReprice: 2 steps, runnable, NEVER_RUN", "listThenReadFirst: 2 steps, runnable, NEVER_RUN"),
            workflows(documents.get(0)));
   }

   private static String describe(ArazzoDocumentSummary document) {
      return document.title() + " " + document.version() + " (" + document.fileName() + ")";
   }

   private static List<String> sources(ArazzoDocumentSummary document) {
      return document.sources().stream().map(ArazzoDocumentSummaryTest::describe).toList();
   }

   private static String describe(ArazzoSourceSummary source) {
      ArazzoSourceLink link = source.link();
      String type = source.apiType() == null ? "" : source.apiType() + " ";
      String api = link.apiName() == null ? "" : " -> " + type + link.apiName() + " " + link.apiVersion();
      return link.sourceName() + api + ": " + (link.linked() ? "linked" : "not linked");
   }

   private static List<String> workflows(ArazzoDocumentSummary document) {
      return document.workflows().stream().map(ArazzoDocumentSummaryTest::describe).toList();
   }

   private static String describe(ArazzoWorkflowSummary workflow) {
      ArazzoWorkflowStatus status = workflow.status();
      return status.workflowId() + ": " + workflow.stepCount() + " steps, "
            + (status.runnable() ? "runnable" : "not runnable " + status.reasons()) + ", " + workflow.lastResult();
   }

   private void apiIsImported(String fileName) throws Exception {
      File contract = new File(ArazzoDocumentSummaryTest.class.getResource(FIXTURES + fileName).toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo(fileName, true));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoDocumentSummaryTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }
}
