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
package io.github.microcks.arazzo;

import io.github.microcks.arazzo.Model.ArazzoDocument;
import io.github.microcks.arazzo.Model.Criterion;
import io.github.microcks.arazzo.Model.Parameter;
import io.github.microcks.arazzo.Model.Replacement;
import io.github.microcks.arazzo.Model.RequestBody;
import io.github.microcks.arazzo.Model.SourceDescription;
import io.github.microcks.arazzo.Model.Step;
import io.github.microcks.arazzo.Model.Workflow;

import org.junit.Test;

import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class ArazzoParserTest {

   private static final String HEADER = """
         arazzo: 1.0.1
         sourceDescriptions:
           - name: pastryApi
             url: pastry.yaml
         workflows:
         """;

   private final ArazzoParser parser = new ArazzoParser();

   @Test
   public void readsTheSupportedSubsetWithItsDefaults() {
      ArazzoDocument document = parser.parse(HEADER + """
            - workflowId: patchPastry
              steps:
                - stepId: patch
                  operationId: PatchPastry
                  parameters:
                    - name: name
                      in: path
                      value: $inputs.name
                  requestBody:
                    payload: {price: 2.6}
                    replacements:
                      - target: /price
                        value: $inputs.price
                  successCriteria:
                    - condition: $statusCode == 200
                    - condition: available
                      type: regex
                      context: $response.body#/status
                  outputs:
                    price: $response.body#/price
                - stepId: list
                  operationId: GetPastries
              outputs:
                price: $steps.patch.outputs.price
            """);

      assertEquals("1.0.1", document.arazzo());
      assertEquals(List.of(new SourceDescription("pastryApi", "pastry.yaml")), document.sourceDescriptions());
      Step patch = new Step("patch", "PatchPastry", List.of(new Parameter("name", "path", "$inputs.name")),
            new RequestBody("application/json", Map.of("price", 2.6),
                  List.of(new Replacement("/price", "$inputs.price"))),
            List.of(new Criterion("$statusCode == 200", "simple", null),
                  new Criterion("available", "regex", "$response.body#/status")),
            Map.of("price", "$response.body#/price"));
      Step list = new Step("list", "GetPastries", List.of(), null, List.of(), Map.of());
      assertEquals(new Workflow("patchPastry", List.of(patch, list), Map.of("price", "$steps.patch.outputs.price")),
            document.workflow("patchPastry"));
   }

   @Test
   public void keepsAnExplicitContentType() {
      ArazzoDocument document = parser.parse(HEADER + """
            - workflowId: w
              steps:
                - stepId: s
                  operationId: o
                  requestBody:
                    contentType: text/xml
                    payload: <price>2.6</price>
            """);
      assertEquals(new RequestBody("text/xml", "<price>2.6</price>", List.of()),
            document.workflow("w").steps().get(0).requestBody());
   }

   @Test
   public void rejectsDocumentsThatAreNotWellFormed() {
      assertRejected("Arazzo document must be an object", "- arazzo");
      assertRejected("Missing required field: arazzo", "info: {}");
      assertRejected("Unsupported Arazzo version: 2.0.0", "arazzo: 2.0.0");
      assertRejected("Missing required field: sourceDescriptions", "arazzo: 1.0.0");
      assertRejected("sourceDescriptions must be a list", "arazzo: 1.0.0\nsourceDescriptions: {}");
      assertRejected("Each item of sourceDescriptions must be an object", "arazzo: 1.0.0\nsourceDescriptions: [a]");
      assertRejected("Missing required field: url", "arazzo: 1.0.0\nsourceDescriptions: [{name: a}]");
      assertRejected("Missing required field: workflowId", HEADER + "- steps: []");
      assertRejected("Missing required field: stepId", HEADER + "- {workflowId: w, steps: [{operationId: o}]}");
      assertRejected("requestBody must be an object",
            HEADER + "- {workflowId: w, steps: [{stepId: s, operationId: o, requestBody: []}]}");
      assertRejected("Missing required field: payload",
            HEADER + "- {workflowId: w, steps: [{stepId: s, operationId: o, requestBody: {}}]}");
      assertRejected("outputs must be an object", HEADER + "- {workflowId: w, steps: [], outputs: [a]}");
      assertRejected("Missing required field: context",
            HEADER + "- {workflowId: w, steps: [{stepId: s, operationId: o, successCriteria: "
                  + "[{condition: x, type: regex}]}]}");
      assertRejected("Missing required field: value",
            HEADER + "- {workflowId: w, steps: [{stepId: s, operationId: o, parameters: [{name: n, in: path}]}]}");
   }

   @Test
   public void rejectsFeaturesOutsideTheScopeOfThisRunner() {
      assertRejected("Unsupported source description type: asyncapi",
            "arazzo: 1.1.0\nsourceDescriptions: [{name: a, url: a.yaml, type: asyncapi}]");
      for (String field : List.of("dependsOn", "successActions", "failureActions")) {
         assertRejected("Unsupported workflow field: " + field,
               HEADER + "- {workflowId: w, steps: [], " + field + ": []}");
      }
      for (String field : List.of("workflowId", "operationPath", "onSuccess", "onFailure")) {
         assertRejected("Unsupported step field: " + field,
               HEADER + "- {workflowId: w, steps: [{stepId: s, operationId: o, " + field + ": x}]}");
      }
      assertRejected("Unsupported parameter location: cookie", HEADER
            + "- {workflowId: w, steps: [{stepId: s, operationId: o, parameters: [{name: n, in: cookie, value: v}]}]}");
      assertRejected("Unsupported criterion type: jsonpath", HEADER
            + "- {workflowId: w, steps: [{stepId: s, operationId: o, successCriteria: [{condition: x, type: jsonpath}]}]}");
   }

   private void assertRejected(String message, String yaml) {
      assertEquals(message, assertThrows(yaml, ArazzoException.class, () -> parser.parse(yaml)).getMessage());
   }
}
