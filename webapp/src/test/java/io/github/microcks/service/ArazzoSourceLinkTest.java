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

import io.github.microcks.domain.ArazzoSourceLink;
import io.github.microcks.domain.ArazzoWorkflowStatus;
import io.github.microcks.repository.RepositoryTestsConfiguration;

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
 * Acceptance tests of the link between the source descriptions of an Arazzo document and the APIs of Microcks, one per
 * acceptance criterion of the story.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = RepositoryTestsConfiguration.class)
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoSourceLinkTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ServiceService serviceService;

   @Test
   void theOverlayLinksASourceToTheApiWithThatNameAndVersion() throws Exception {
      apiIsImported("api-pastry-2.0.openapi.yaml");

      arazzoDocumentService.importArazzoDocument(fixture("pastry.arazzo.yaml"));
      arazzoDocumentService.importArazzoSources(fixture("pastry.arazzo-sources.yaml"));

      assertEquals(List.of("pastryApi -> API Pastry - 2.0 2.0.0: linked"),
            sourceLinks("API Pastry scenarios", "1.0.0"));
      assertEquals(List.of("readThenReprice: runnable", "listThenReadFirst: runnable"),
            workflowStatuses("API Pastry scenarios", "1.0.0"));
   }

   @Test
   void aSourceMappedToAnApiAbsentFromMicrocksStaysUnlinked() throws Exception {
      apiIsImported("customer-api.openapi.yaml");

      arazzoDocumentService.importArazzoDocument(fixture("order-fulfilment.arazzo.yaml"));
      arazzoDocumentService.importArazzoSources(fixture("order-fulfilment.arazzo-sources.yaml"));

      assertEquals(List.of("customerApi -> Customer API 1.0.0: linked", "orderApi -> Order API 1.0.0: not linked"),
            sourceLinks("Order fulfilment", "1.0.0"));
      assertEquals(List.of("searchThenRead: runnable", "placeOrder: not runnable"),
            workflowStatuses("Order fulfilment", "1.0.0"));
   }

   private List<String> sourceLinks(String title, String version) {
      return arazzoDocumentService.getSourceLinks(title, version).stream().map(ArazzoSourceLinkTest::describe).toList();
   }

   private List<String> workflowStatuses(String title, String version) {
      return arazzoDocumentService.getWorkflowStatuses(title, version).stream().map(ArazzoSourceLinkTest::describe)
            .toList();
   }

   private static String describe(ArazzoSourceLink link) {
      return link.sourceName() + " -> " + link.apiName() + " " + link.apiVersion() + ": "
            + (link.linked() ? "linked" : "not linked");
   }

   private static String describe(ArazzoWorkflowStatus status) {
      return status.workflowId() + ": " + (status.runnable() ? "runnable" : "not runnable");
   }

   private void apiIsImported(String fileName) throws Exception {
      File contract = new File(ArazzoSourceLinkTest.class.getResource(FIXTURES + fileName).toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo(fileName, true));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoSourceLinkTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }
}
