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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads an Arazzo document. Shared by the Microcks webapp, which imports documents, and the components that run their
 * workflows: it knows the Arazzo specification only, and no Microcks model.
 * @author SebastienDegodez
 */
public final class ArazzoDocumentReader {

   private static final String SOURCE_DESCRIPTIONS_EXPRESSION = "$sourceDescriptions.";

   private ArazzoDocumentReader() {
   }

   /**
    * @param document A document parsed from YAML or JSON
    * @return Whether the document declares the version of Arazzo it uses, as every Arazzo document does
    */
   public static boolean isArazzoDocument(JsonNode document) {
      return document.has("arazzo");
   }

   /**
    * @param document The Arazzo document, parsed from YAML or JSON
    * @return What identifies the document
    * @throws UnsupportedArazzoDocumentException if the document is outside of the subset Microcks supports
    */
   public static ArazzoDescription read(JsonNode document) throws UnsupportedArazzoDocumentException {
      ArazzoSubset.check(document);
      JsonNode info = document.path("info");
      List<String> workflowIds = new ArrayList<>();
      for (JsonNode workflow : document.path("workflows")) {
         workflowIds.add(workflow.path("workflowId").asText());
      }
      return new ArazzoDescription(info.path("title").asText(), info.path("version").asText(), workflowIds);
   }

   /**
    * @param document The Arazzo document, parsed from YAML or JSON
    * @return The names of its source descriptions, in the order of the document
    */
   public static List<String> sourceDescriptionNames(JsonNode document) {
      List<String> names = new ArrayList<>();
      for (JsonNode sourceDescription : document.path("sourceDescriptions")) {
         names.add(sourceDescription.path("name").asText());
      }
      return names;
   }

   /**
    * @param document The Arazzo document, parsed from YAML or JSON
    * @return For each workflow id, the names of the source descriptions its steps call, in the order of the steps
    */
   public static Map<String, List<String>> workflowSourceNames(JsonNode document) {
      List<String> sourceNames = sourceDescriptionNames(document);
      Map<String, List<String>> workflowSourceNames = new LinkedHashMap<>();
      for (JsonNode workflow : document.path("workflows")) {
         List<String> calledSourceNames = new ArrayList<>();
         for (JsonNode step : workflow.path("steps")) {
            calledSourceNames.add(calledSourceName(step.path("operationId").asText(), sourceNames));
         }
         workflowSourceNames.put(workflow.path("workflowId").asText(), calledSourceNames);
      }
      return workflowSourceNames;
   }

   private static String calledSourceName(String operationId, List<String> sourceNames) {
      if (operationId.startsWith(SOURCE_DESCRIPTIONS_EXPRESSION)) {
         // A source name has no dot, an operationId may have some.
         return operationId.substring(SOURCE_DESCRIPTIONS_EXPRESSION.length(),
               operationId.indexOf('.', SOURCE_DESCRIPTIONS_EXPRESSION.length()));
      }
      // Arazzo requires an operationId to name its source when there are several: alone, it calls the only one.
      return sourceNames.get(0);
   }
}
