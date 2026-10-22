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

import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.ArazzoStepOperation;
import io.github.microcks.util.arazzo.ArazzoStep;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Verifies the calls an application made to the mocks in a session against the steps of a workflow: a step is matched
 * to the first call, in the order of receipt, that no earlier step took and that calls its operation, its method and
 * path template, on the mocks of the API its source is linked to.
 * @author SebastienDegodez
 */
final class ArazzoSessionVerifier {

   private ArazzoSessionVerifier() {
   }

   /**
    * A step of the workflow, with the operation it calls and the Microcks API its source is linked to.
    * @param index      The place of the step in the workflow, from 0
    * @param step       The step
    * @param operation  The operation it calls in the linked API
    * @param apiName    The name of the linked API
    * @param apiVersion The version of the linked API
    */
   record ExpectedStep(int index, ArazzoStep step, ArazzoStepOperation operation, String apiName, String apiVersion) {
   }

   /**
    * How a step was verified.
    * @param expected The step
    * @param call     The call matched to it; null when none was
    */
   record StepVerdict(ExpectedStep expected, ArazzoSessionCall call) {
   }

   /**
    * @param steps The steps of the workflow, in its order
    * @param calls The calls of the session, in their order of receipt
    * @return The verdict of each step, in the order of the workflow
    */
   static List<StepVerdict> verify(List<ExpectedStep> steps, List<ArazzoSessionCall> calls) {
      Set<Long> taken = new HashSet<>();
      List<StepVerdict> verdicts = new ArrayList<>();
      for (ExpectedStep step : steps) {
         Optional<ArazzoSessionCall> call = calls.stream()
               .filter(candidate -> !taken.contains(candidate.getIndex()) && calls(candidate, step)).findFirst();
         call.ifPresent(matched -> taken.add(matched.getIndex()));
         verdicts.add(new StepVerdict(step, call.orElse(null)));
      }
      return verdicts;
   }

   /** Microcks names an operation of an OpenAPI contract by its method and path template. */
   private static boolean calls(ArazzoSessionCall call, ExpectedStep step) {
      return step.apiName().equals(call.getServiceName()) && step.apiVersion().equals(call.getServiceVersion())
            && (step.operation().method() + " " + step.operation().path()).equals(call.getOperationName());
   }
}
