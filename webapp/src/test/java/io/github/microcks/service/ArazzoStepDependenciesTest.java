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
import io.github.microcks.domain.ArazzoImportAnalysis;
import io.github.microcks.domain.ArazzoWorkflowDetail;
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.domain.WorkflowRunStatus;
import io.github.microcks.domain.WorkflowStepOperation;
import io.github.microcks.domain.WorkflowStepResult;
import io.github.microcks.domain.WorkflowStepStatus;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.repository.WorkflowResultRepository;
import io.github.microcks.util.MockRepositoryImportException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Acceptance tests of S30, accepting the dependsOn of the steps of an Arazzo 1.1 workflow, one or more per acceptance
 * criterion of the story. They enter through the services of the webapp with the Arazzo minion standing at its
 * boundary. The demo of the story is Pastry tasting: readMenu, then three steps that only depend on it, then reprice,
 * without dependsOn, after all of them. The refused examples are in {@code step-dependencies.arazzo.yaml}.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class,
      ArazzoStepDependenciesTest.MinionAtTheBoundary.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" }, properties = { "arazzo.mock-url.timeout=600" })
class ArazzoStepDependenciesTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";
   private static final String REFUSED = "step-dependencies.arazzo.yaml";
   private static final String WORKFLOW = "tasteThenReprice";
   private static final List<String> STEPS = List.of("readMenu", "tasteEclair", "tasteMillefeuille", "tasteEclairXml",
         "reprice");

   @TestConfiguration
   static class MinionAtTheBoundary {

      @Bean
      @Primary
      RecordingMinionClient recordingMinionClient() {
         return new RecordingMinionClient();
      }
   }

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ArazzoImportService arazzoImportService;

   @Autowired
   private ArazzoWorkflowService arazzoWorkflowService;

   @Autowired
   private ArazzoRunService arazzoRunService;

   @Autowired
   private ArazzoMockUrlService arazzoMockUrlService;

   @Autowired
   private ServiceService serviceService;

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Autowired
   private WorkflowResultRepository workflowResultRepository;

   @Autowired
   private RecordingMinionClient minion;

   /** AC-01: an Arazzo 1.1 workflow whose steps declare dependsOn is imported, and can run. */
   @Test
   void aWorkflowWhoseStepsDeclareDependsOnIsImportedAndCanRun() throws Exception {
      ArazzoDocument document = pastryTastingIsImportedAndLinked();

      ArazzoWorkflowDetail workflow = arazzoWorkflowService.getWorkflowDetail(document.getId(), WORKFLOW).orElseThrow();

      assertEquals("Pastry tasting 1.0.0 1.1.0 [tasteThenReprice]", document.getTitle() + " " + document.getVersion()
            + " " + document.getArazzoVersion() + " " + document.getWorkflowIds());
      assertTrue(workflow.status().runnable(), workflow.status().reasons().toString());
   }

   /**
    * AC-02: a dependsOn that cannot be satisfied is refused whole, with its reason; a dependsOn pointing to a step
    * listed later is refused until the runner plays steps in another order than the list; the dependsOn of a workflow
    * stays refused.
    */
   @ParameterizedTest
   @CsvSource(delimiter = ';', value = {
         "unknown-step; Invalid Arazzo document: tasteEclair depends on an unknown step: readMenus",
         "itself; Invalid Arazzo document: a step cannot depend on itself: tasteEclair",
         "cycle; Invalid Arazzo document: steps depend on each other in a cycle: readMenu, tasteEclair",
         "later; Unsupported step order: tasteEclair depends on readMenu, listed after it",
         "arazzo-1-0; Invalid Arazzo document: a step dependsOn needs Arazzo 1.1, not 1.0.1: tasteEclair",
         "other-workflow; Unsupported step dependency on another workflow: $workflows.readMenu.steps.readMenu",
         "workflow-depends-on; Unsupported workflow field: dependsOn" })
   void aDependsOnThatCannotBeSatisfiedIsRefusedWholeWithItsReason(String example, String reason) throws Exception {
      String content = exampleOf(REFUSED, example);

      ArazzoImportAnalysis analysis = arazzoImportService.analyseArazzoDocument(content, null);
      MockRepositoryImportException refusal = assertThrows(MockRepositoryImportException.class,
            () -> arazzoImportService.importArazzoDocument(content, example + ".arazzo.yaml", Map.of()));

      assertEquals(reason, analysis.refusal());
      assertEquals(reason, refusal.getMessage());
      assertEquals(0, arazzoDocumentRepository.count());
   }

   /**
    * AC-03: the workflow page gives the steps each step declares it depends on, and the steps it must come after: the
    * steps it names and those whose outputs it uses, or all the steps listed before it when it names none.
    */
   @Test
   void theWorkflowPageGivesWhatEachStepDependsOnAndMustComeAfter() throws Exception {
      ArazzoDocument document = pastryTastingIsImportedAndLinked();

      ArazzoWorkflowDetail workflow = arazzoWorkflowService.getWorkflowDetail(document.getId(), WORKFLOW).orElseThrow();

      assertEquals(
            List.of("readMenu [] after []", "tasteEclair [readMenu] after [readMenu]",
                  "tasteMillefeuille [readMenu] after [readMenu]", "tasteEclairXml [readMenu] after [readMenu]",
                  "reprice [] after [readMenu, tasteEclair, tasteMillefeuille, tasteEclairXml]"),
            workflow.steps().stream()
                  .map(step -> step.stepId() + " " + step.dependsOn() + " after " + step.prerequisites()).toList());
   }

   /**
    * AC-04: a run launched from the UI, from the CI API by title and version, or through the Mock URL hands the
    * document as imported to the minion, which plays its steps in the order of the list, and passes.
    */
   @ParameterizedTest
   @CsvSource({ "UI", "CI API", "Mock URL" })
   void aRunPlaysTheStepsInTheOrderOfTheListAndPasses(String origin) throws Exception {
      ArazzoDocument document = pastryTastingIsImportedAndLinked();
      minion.plays(request -> {
         for (int index = 0; index < STEPS.size(); index++) {
            arazzoRunService.recordStep(request.runId(), passed(index, STEPS.get(index)), null, null);
         }
         arazzoRunService.recordOutcome(request.runId(), WorkflowRunStatus.SUCCESS, Map.of("price", 2.6), 25, null);
      });
      Map<String, Object> inputs = Map.of("newPrice", 2.6);

      switch (origin) {
         case "UI" -> arazzoRunService.launchRun(document.getId(), WORKFLOW, inputs, null);
         case "CI API" -> arazzoRunService.launchRun("Pastry tasting:1.0.0", WORKFLOW, inputs, null);
         default -> assertEquals(200,
               arazzoMockUrlService.play("Pastry tasting", "1.0.0", WORKFLOW, "{\"newPrice\": 2.6}").status());
      }

      WorkflowResult run = workflowResultRepository.findAll().get(0);
      assertEquals(document.getContent(), minion.requests().get(0).arazzoDocument());
      assertEquals(WorkflowRunStatus.SUCCESS, run.getStatus());
      assertEquals(STEPS, run.getSteps().stream().map(WorkflowStepResult::stepId).toList());
   }

   private static WorkflowStepResult passed(int index, String stepId) {
      return new WorkflowStepResult(index, stepId,
            new WorkflowStepOperation("pastryApi", "GetPastryByName", "GET", "/pastry/{name}"),
            WorkflowStepStatus.PASSED, 200, 5, List.of(), Map.of(), null, null, null, List.of(), Map.of());
   }

   private ArazzoDocument pastryTastingIsImportedAndLinked() throws Exception {
      File contract = new File(
            ArazzoStepDependenciesTest.class.getResource(FIXTURES + "api-pastry-2.0.openapi.yaml").toURI());
      serviceService.importServiceDefinition(contract, null, new ArtifactInfo("api-pastry-2.0.openapi.yaml", true));
      arazzoDocumentService.importArazzoSources(fixture("pastry-tasting.arazzo-sources.yaml"));
      return arazzoDocumentService.importArazzoDocument(fixture("pastry-tasting.arazzo.yaml"));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoStepDependenciesTest.class.getResourceAsStream(FIXTURES + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }

   /** The example of a multi-document fixture announced by its {@code # example: <name>} comment. */
   private static String exampleOf(String fileName, String example) throws IOException {
      String marker = "# example: " + example + " ";
      return Arrays.stream(fixture(fileName).split("\n---\n")).filter(document -> document.contains(marker)).findFirst()
            .orElseThrow(() -> new IllegalArgumentException(example + " is not in " + fileName));
   }
}
