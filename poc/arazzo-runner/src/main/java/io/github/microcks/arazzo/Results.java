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

/** Outcome of the execution of a workflow and of each of its steps. */
public final class Results {

   private Results() {
   }

   /**
    * Outcome of a step. The status code is null when no response was received; error explains why the step could
    * not be evaluated, and failedCriteria lists the conditions that did not hold.
    */
   public record StepResult(String stepId, Integer statusCode, boolean success, List<String> failedCriteria,
         Map<String, Object> outputs, String error) {

      static StepResult succeeded(String stepId, int statusCode, Map<String, Object> outputs) {
         return new StepResult(stepId, statusCode, true, List.of(), outputs, null);
      }

      static StepResult failed(String stepId, Integer statusCode, List<String> failedCriteria, String error) {
         return new StepResult(stepId, statusCode, false, failedCriteria, Map.of(), error);
      }
   }

   /** Outcome of a workflow: the executed steps, in order, and the workflow outputs when it succeeded. */
   public record WorkflowResult(String workflowId, boolean success, List<StepResult> steps,
         Map<String, Object> outputs, String error) {

      static WorkflowResult succeeded(String workflowId, List<StepResult> steps, Map<String, Object> outputs) {
         return new WorkflowResult(workflowId, true, steps, outputs, null);
      }

      static WorkflowResult failed(String workflowId, List<StepResult> steps, String error) {
         return new WorkflowResult(workflowId, false, steps, Map.of(), error);
      }
   }
}
