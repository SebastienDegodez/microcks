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
package io.github.microcks.util.arazzo;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Set;

/**
 * The part of the Arazzo specification Microcks supports. A document outside of it is refused rather than partly
 * ignored.
 * @author SebastienDegodez
 */
final class ArazzoSubset {

   /** The runtime expression prefix of an operationId that names its source description. */
   static final String SOURCE_DESCRIPTIONS_EXPRESSION = "$sourceDescriptions.";

   private static final List<String> UNSUPPORTED_WORKFLOW_FIELDS = List.of("dependsOn", "successActions",
         "failureActions");
   private static final List<String> UNSUPPORTED_STEP_FIELDS = List.of("workflowId", "operationPath", "onSuccess",
         "onFailure");
   private static final Set<String> PARAMETER_LOCATIONS = Set.of("path", "query", "header");
   private static final Set<String> CRITERION_TYPES = Set.of("simple", "regex");

   private ArazzoSubset() {
   }

   /**
    * @param document The Arazzo document, parsed from YAML or JSON
    * @throws UnsupportedArazzoDocumentException if the document is outside of the subset
    */
   static void check(JsonNode document) throws UnsupportedArazzoDocumentException {
      String arazzoVersion = document.path("arazzo").asText();
      if (!arazzoVersion.startsWith("1.")) {
         throw new UnsupportedArazzoDocumentException("Unsupported Arazzo version: " + arazzoVersion);
      }
      for (JsonNode sourceDescription : document.path("sourceDescriptions")) {
         checkSourceDescription(sourceDescription);
      }
      boolean severalSourceDescriptions = document.path("sourceDescriptions").size() > 1;
      for (JsonNode workflow : document.path("workflows")) {
         checkWorkflow(workflow, severalSourceDescriptions);
      }
   }

   private static void checkSourceDescription(JsonNode sourceDescription) throws UnsupportedArazzoDocumentException {
      String type = sourceDescription.path("type").asText("openapi");
      if (!type.equals("openapi")) {
         throw new UnsupportedArazzoDocumentException("Unsupported source description type: " + type);
      }
   }

   private static void checkWorkflow(JsonNode workflow, boolean severalSourceDescriptions)
         throws UnsupportedArazzoDocumentException {
      rejectFields(workflow, UNSUPPORTED_WORKFLOW_FIELDS, "workflow");
      for (JsonNode parameter : workflow.path("parameters")) {
         checkParameter(parameter);
      }
      for (JsonNode step : workflow.path("steps")) {
         checkStep(step, severalSourceDescriptions);
      }
   }

   private static void checkStep(JsonNode step, boolean severalSourceDescriptions)
         throws UnsupportedArazzoDocumentException {
      rejectFields(step, UNSUPPORTED_STEP_FIELDS, "step");
      for (JsonNode parameter : step.path("parameters")) {
         checkParameter(parameter);
      }
      for (JsonNode criterion : step.path("successCriteria")) {
         checkCriterion(criterion);
      }
      // Arazzo requires an operationId to name its source description when there are several.
      String operationId = step.path("operationId").asText();
      if (severalSourceDescriptions && !operationId.startsWith(SOURCE_DESCRIPTIONS_EXPRESSION)) {
         throw new UnsupportedArazzoDocumentException(
               "Ambiguous operationId " + operationId + ": the document has several source descriptions");
      }
   }

   private static void checkParameter(JsonNode parameter) throws UnsupportedArazzoDocumentException {
      String location = parameter.path("in").asText();
      if (!PARAMETER_LOCATIONS.contains(location)) {
         throw new UnsupportedArazzoDocumentException("Unsupported parameter location: " + location);
      }
   }

   private static void checkCriterion(JsonNode criterion) throws UnsupportedArazzoDocumentException {
      String type = criterion.path("type").asText("simple");
      if (!CRITERION_TYPES.contains(type)) {
         throw new UnsupportedArazzoDocumentException("Unsupported criterion type: " + type);
      }
   }

   private static void rejectFields(JsonNode node, List<String> fields, String owner)
         throws UnsupportedArazzoDocumentException {
      for (String field : fields) {
         if (node.has(field)) {
            throw new UnsupportedArazzoDocumentException("Unsupported " + owner + " field: " + field);
         }
      }
   }
}
