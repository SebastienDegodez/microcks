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
package io.github.microcks.domain;

import java.util.List;
import java.util.Map;

/**
 * The recorded example a run plays: its name, what it expects, and, once the run ended, whether the run matches it.
 * @param name              The name of the example
 * @param outputs           The outputs the workflow is expected to produce, by name
 * @param steps             What each listed step is expected to show
 * @param stopsAt           The step the workflow is expected to stop at; null when it is expected to run to its end
 * @param verdict           Whether the run matches the example; null while the run is in progress
 * @param unmetExpectations Each expectation the run does not meet
 * @author SebastienDegodez
 */
public record WorkflowExampleCheck(String name, Map<String, Object> outputs, List<ArazzoStepExpectation> steps,
      String stopsAt, WorkflowExampleVerdict verdict, List<String> unmetExpectations) {

   /**
    * @param example A recorded example of a workflow
    * @return What a run playing the example expects, not judged yet
    */
   public static WorkflowExampleCheck expecting(ArazzoWorkflowExample example) {
      return new WorkflowExampleCheck(example.name(), example.outputs(), example.steps(), example.stopsAt(), null,
            List.of());
   }

   /**
    * @param unmet Each expectation the run does not meet
    * @return This check once the run ended: the run matches the example when it meets every expectation
    */
   public WorkflowExampleCheck judged(List<String> unmet) {
      return new WorkflowExampleCheck(name, outputs, steps, stopsAt,
            unmet.isEmpty() ? WorkflowExampleVerdict.MATCHES : WorkflowExampleVerdict.DOES_NOT_MATCH,
            List.copyOf(unmet));
   }
}
