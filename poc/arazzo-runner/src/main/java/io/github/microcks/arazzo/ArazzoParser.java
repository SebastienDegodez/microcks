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

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reads an Arazzo 1.x document. Features outside the scope of this proof of concept are rejected explicitly rather
 * than silently ignored.
 */
public final class ArazzoParser {

   private static final List<String> UNSUPPORTED_WORKFLOW_FIELDS = List.of("dependsOn", "successActions",
         "failureActions");
   private static final List<String> UNSUPPORTED_STEP_FIELDS = List.of("workflowId", "operationPath", "onSuccess",
         "onFailure");
   private static final Set<String> PARAMETER_LOCATIONS = Set.of("path", "query", "header");
   private static final Set<String> CRITERION_TYPES = Set.of("simple", "regex");

   public ArazzoDocument parse(String content) {
      Map<String, Object> root = Yamls.load(content, "Arazzo document");
      String version = Yamls.string(root, "arazzo");
      if (!version.startsWith("1.")) {
         throw new ArazzoException("Unsupported Arazzo version: " + version);
      }
      List<SourceDescription> sources = Yamls.requiredMaps(root, "sourceDescriptions").stream()
            .map(ArazzoParser::source).toList();
      List<Workflow> workflows = Yamls.requiredMaps(root, "workflows").stream().map(ArazzoParser::workflow).toList();
      return new ArazzoDocument(version, sources, workflows);
   }

   private static SourceDescription source(Map<String, Object> node) {
      String type = Yamls.optionalString(node, "type", "openapi");
      if (!type.equals("openapi")) {
         throw new ArazzoException("Unsupported source description type: " + type);
      }
      return new SourceDescription(Yamls.string(node, "name"), Yamls.string(node, "url"));
   }

   private static Workflow workflow(Map<String, Object> node) {
      rejectUnsupported(node, UNSUPPORTED_WORKFLOW_FIELDS, "workflow");
      List<Step> steps = Yamls.requiredMaps(node, "steps").stream().map(ArazzoParser::step).toList();
      return new Workflow(Yamls.string(node, "workflowId"), steps, Yamls.optionalStrings(node, "outputs"));
   }

   private static Step step(Map<String, Object> node) {
      rejectUnsupported(node, UNSUPPORTED_STEP_FIELDS, "step");
      List<Parameter> parameters = Yamls.optionalMaps(node, "parameters").stream().map(ArazzoParser::parameter)
            .toList();
      Object body = node.get("requestBody");
      RequestBody requestBody = body == null ? null : requestBody(Yamls.map(body, "requestBody"));
      List<Criterion> criteria = Yamls.optionalMaps(node, "successCriteria").stream().map(ArazzoParser::criterion)
            .toList();
      return new Step(Yamls.string(node, "stepId"), Yamls.string(node, "operationId"), parameters, requestBody,
            criteria, Yamls.optionalStrings(node, "outputs"));
   }

   private static Parameter parameter(Map<String, Object> node) {
      String in = Yamls.string(node, "in");
      if (!PARAMETER_LOCATIONS.contains(in)) {
         throw new ArazzoException("Unsupported parameter location: " + in);
      }
      return new Parameter(Yamls.string(node, "name"), in, Yamls.required(node, "value"));
   }

   private static RequestBody requestBody(Map<String, Object> node) {
      List<Replacement> replacements = Yamls.optionalMaps(node, "replacements").stream()
            .map(r -> new Replacement(Yamls.string(r, "target"), Yamls.required(r, "value"))).toList();
      return new RequestBody(Yamls.optionalString(node, "contentType", "application/json"),
            Yamls.required(node, "payload"), replacements);
   }

   private static Criterion criterion(Map<String, Object> node) {
      String type = Yamls.optionalString(node, "type", "simple");
      if (!CRITERION_TYPES.contains(type)) {
         throw new ArazzoException("Unsupported criterion type: " + type);
      }
      String context = type.equals("regex") ? Yamls.string(node, "context") : null;
      return new Criterion(Yamls.string(node, "condition"), type, context);
   }

   private static void rejectUnsupported(Map<String, Object> node, List<String> fields, String owner) {
      for (String field : fields) {
         if (node.containsKey(field)) {
            throw new ArazzoException("Unsupported " + owner + " field: " + field);
         }
      }
   }
}
