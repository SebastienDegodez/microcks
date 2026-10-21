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

/**
 * The part of the Arazzo specification Microcks supports. A document outside of it is refused rather than partly
 * ignored.
 * @author SebastienDegodez
 */
final class ArazzoSubset {

   private static final List<String> UNSUPPORTED_STEP_FIELDS = List.of("onFailure");

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
      for (JsonNode workflow : document.path("workflows")) {
         checkWorkflow(workflow);
      }
   }

   private static void checkWorkflow(JsonNode workflow) throws UnsupportedArazzoDocumentException {
      for (JsonNode step : workflow.path("steps")) {
         rejectFields(step, UNSUPPORTED_STEP_FIELDS, "step");
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
