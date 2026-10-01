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

import java.util.List;
import java.util.Map;

/** The subset of the Arazzo object model understood by this runner. */
public final class Model {

   private Model() {
   }

   /** Root of an Arazzo document. */
   public record ArazzoDocument(String arazzo, List<SourceDescription> sourceDescriptions, List<Workflow> workflows) {

      public Workflow workflow(String workflowId) {
         return workflows.stream().filter(w -> w.workflowId().equals(workflowId)).findFirst()
               .orElseThrow(() -> new ArazzoException("Unknown workflow: " + workflowId));
      }
   }

   /** An OpenAPI description the workflow steps refer to. */
   public record SourceDescription(String name, String url) {
   }

   /** An ordered sequence of steps, with the outputs it exposes once successful. */
   public record Workflow(String workflowId, List<Step> steps, Map<String, String> outputs) {
   }

   /** A call to an API operation, its success criteria and the outputs it extracts from the response. */
   public record Step(String stepId, String operationId, List<Parameter> parameters, RequestBody requestBody,
         List<Criterion> successCriteria, Map<String, String> outputs) {
   }

   /** A parameter sent in the path, the query string or a header. */
   public record Parameter(String name, String in, Object value) {
   }

   /** The body sent by a step, and the values replaced in it before the call. */
   public record RequestBody(String contentType, Object payload, List<Replacement> replacements) {
   }

   /** A value written at a JSON pointer of the payload. */
   public record Replacement(String target, Object value) {
   }

   /** A success criterion: a simple condition, or a regex applied to a context expression. */
   public record Criterion(String condition, String type, String context) {
   }
}
