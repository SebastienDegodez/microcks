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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.ArazzoStepDetail;
import io.github.microcks.domain.ArazzoStepOperation;
import io.github.microcks.domain.ArazzoWorkflowDetail;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.RepositoryTestsConfiguration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Acceptance tests of reading the steps of an Arazzo workflow, one per acceptance criterion of the story.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = RepositoryTestsConfiguration.class)
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoWorkflowDetailTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";

   @Autowired
   private ArazzoWorkflowService arazzoWorkflowService;

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ServiceService serviceService;

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Test
   void eachStepShowsItsOperationParametersCriteriaAndOutputs() throws Exception {
      ArazzoDocument document = pastryScenariosAreImportedAndLinked();

      ArazzoWorkflowDetail workflow = arazzoWorkflowService.getWorkflowDetail(document.getId(), "readThenReprice")
            .orElseThrow();

      assertEquals(List.of(
            List.of("readPastry calls GET /pastry/{name} (GetPastryByName)", "parameter name in path = $inputs.pastry",
                  "parameter Accept in header = application/json",
                  "criterion $statusCode == 200 && $response.body#/status == 'available'",
                  "output name = $response.body#/name", "output price = $response.body#/price"),
            List.of("reprice calls PATCH /pastry/{name} (PatchPastry)",
                  "parameter name in path = $steps.readPastry.outputs.name",
                  "parameter Accept in header = application/json",
                  "body application/json {\"price\":0} with /price = $inputs.newPrice", "criterion $statusCode == 200",
                  "criterion $response.body#/price == $inputs.newPrice", "output price = $response.body#/price")),
            workflow.steps().stream().map(ArazzoWorkflowDetailTest::describe).toList());
   }

   /** Maintainer decision: a step whose operation is not found shows its operationId alone, with the S2 reason. */
   @ParameterizedTest
   @CsvSource(delimiter = ';', value = {
         "pastry-scenarios.arazzo.yaml; false; false; readPastry calls GetPastryByName: no API name and version for "
               + "this source | reprice calls PatchPastry: no API name and version for this source",
         "pastry-scenarios.arazzo.yaml; false; true; readPastry calls GetPastryByName: API API Pastry - 2.0 2.0.0 not "
               + "found | reprice calls PatchPastry: API API Pastry - 2.0 2.0.0 not found",
         "pastry-delete.arazzo.yaml; true; true; readPastry calls GET /pastry/{name} (GetPastryByName) | reprice calls "
               + "PATCH /pastry/{name} (PatchPastry) | deletePastry calls DeletePastry: Operation DeletePastry not "
               + "found in API Pastry - 2.0 2.0.0" })
   void aStepWhoseOperationIsNotFoundShowsItsOperationIdAloneWithTheReason(String fixture, boolean apiImported,
         boolean overlayImported, String operations) throws Exception {
      if (apiImported) {
         apiIsImported("api-pastry-2.0.openapi.yaml");
      }
      if (overlayImported) {
         arazzoDocumentService.importArazzoSources(fixture("pastry.arazzo-sources.yaml"));
      }
      ArazzoDocument document = arazzoDocumentService.importArazzoDocument(fixture(fixture));

      ArazzoWorkflowDetail workflow = arazzoWorkflowService.getWorkflowDetail(document.getId(), "readThenReprice")
            .orElseThrow();

      assertEquals(operations, String.join(" | ",
            workflow.steps().stream().map(step -> step.stepId() + " calls " + describe(step.operation())).toList()));
   }

   /** Maintainer decision: one tab per workflow of the document, each reached by the id of the workflow. */
   @Test
   void eachWorkflowOfTheDocumentIsReachedFromItsTab() throws Exception {
      ArazzoDocument document = pastryScenariosAreImportedAndLinked();

      ArazzoWorkflowDetail workflow = arazzoWorkflowService.getWorkflowDetail(document.getId(), "listThenReadFirst")
            .orElseThrow();

      assertEquals(document.getId(), workflow.documentId());
      assertEquals("API Pastry scenarios 1.0.0 [readThenReprice, listThenReadFirst]",
            workflow.title() + " " + workflow.version() + " " + workflow.workflowIds());
      assertEquals("listThenReadFirst: Reads the first pastry of the list. (null)",
            workflow.workflowId() + ": " + workflow.summary() + " (" + workflow.description() + ")");
      assertEquals(List.of("pastryApi -> API Pastry - 2.0 2.0.0: linked"),
            workflow.sources().stream().map(link -> link.sourceName() + " -> " + link.apiName() + " "
                  + link.apiVersion() + ": " + (link.linked() ? "linked" : "not linked")).toList());
      assertEquals(
            List.of("list calls GET /pastry (GetPastries)", "readFirst calls GET /pastry/{name} (GetPastryByName)"),
            workflow.steps().stream().map(step -> step.stepId() + " calls " + describe(step.operation())).toList());
   }

   @ParameterizedTest
   @CsvSource({ "false, readThenReprice", "true, unknown" })
   void anUnknownDocumentOrWorkflowHasNoDetail(boolean knownDocument, String workflowId) throws Exception {
      ArazzoDocument document = pastryScenariosAreImportedAndLinked();

      assertEquals(Optional.empty(),
            arazzoWorkflowService.getWorkflowDetail(knownDocument ? document.getId() : "unknown", workflowId));
   }

   @Test
   void aStoredDocumentThatCannotBeReadHasNoWorkflow() throws Exception {
      ArazzoDocument document = pastryScenariosAreImportedAndLinked();
      document.setContent("workflows: [ readThenReprice");
      arazzoDocumentRepository.save(document);

      assertEquals(Optional.empty(), arazzoWorkflowService.getWorkflowDetail(document.getId(), "readThenReprice"));
   }

   private ArazzoDocument pastryScenariosAreImportedAndLinked() throws Exception {
      apiIsImported("api-pastry-2.0.openapi.yaml");
      arazzoDocumentService.importArazzoSources(fixture("pastry.arazzo-sources.yaml"));
      return arazzoDocumentService.importArazzoDocument(fixture("pastry-scenarios.arazzo.yaml"));
   }

   private static List<String> describe(ArazzoStepDetail step) {
      List<String> lines = new ArrayList<>();
      lines.add(step.stepId() + " calls " + describe(step.operation()));
      step.parameters().forEach(parameter -> lines
            .add("parameter " + parameter.name() + " in " + parameter.in() + " = " + parameter.value()));
      if (step.requestBody() != null) {
         lines.add("body " + step.requestBody().contentType() + " " + step.requestBody().payload().replaceAll("\\s", "")
               + " with " + String.join(", ", step.requestBody().replacements().entrySet().stream()
                     .map(replacement -> replacement.getKey() + " = " + replacement.getValue()).toList()));
      }
      step.successCriteria().forEach(criterion -> lines.add("criterion " + criterion.condition()));
      step.outputs().forEach((name, expression) -> lines.add("output " + name + " = " + expression));
      return lines;
   }

   private static String describe(ArazzoStepOperation operation) {
      if (operation.reason() != null) {
         return operation.operationId() + ": " + operation.reason();
      }
      return operation.method() + " " + operation.path() + " (" + operation.operationId() + ")";
   }

   private void apiIsImported(String fileName) throws Exception {
      File contract = new File(ArazzoWorkflowDetailTest.class.getResource(FIXTURES + fileName).toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo(fileName, true));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoWorkflowDetailTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }
}
