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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Verifies the calls an application made to the mocks in a session against the steps of a workflow: a step is matched
 * to the first call, in the order of receipt, that no earlier step took and that calls its operation, its method and
 * path template, on the mocks of the API its source is linked to. A step without call is missing; then the order of the
 * calls is checked, as the session asks.
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
    * @param failures Why the step fails, in the order they were found; empty when it passes
    */
   record StepVerdict(ExpectedStep expected, ArazzoSessionCall call, List<String> failures) {
   }

   /**
    * @param steps The steps of the workflow, in its order
    * @param calls The calls of the session, in their order of receipt
    * @param order The order the calls matched to the steps are expected in
    * @return The verdict of each step, in the order of the workflow
    */
   static List<StepVerdict> verify(List<ExpectedStep> steps, List<ArazzoSessionCall> calls, ArazzoCallOrder order) {
      Map<ExpectedStep, ArazzoSessionCall> matched = match(steps, calls);
      List<StepVerdict> verdicts = new ArrayList<>();
      for (ExpectedStep step : steps) {
         ArazzoSessionCall call = matched.get(step);
         List<String> failures = new ArrayList<>();
         if (call == null) {
            failures.add("step `" + step.step().stepId() + "` missing");
         } else {
            order.violation(step, call, matched).ifPresent(failures::add);
         }
         verdicts.add(new StepVerdict(step, call, failures));
      }
      return verdicts;
   }

   /** The call matched to each step that has one, in the order of the workflow. */
   private static Map<ExpectedStep, ArazzoSessionCall> match(List<ExpectedStep> steps, List<ArazzoSessionCall> calls) {
      Set<Long> taken = new HashSet<>();
      Map<ExpectedStep, ArazzoSessionCall> matched = new LinkedHashMap<>();
      for (ExpectedStep step : steps) {
         Optional<ArazzoSessionCall> call = calls.stream()
               .filter(candidate -> !taken.contains(candidate.getIndex()) && calls(candidate, step)).findFirst();
         call.ifPresent(found -> {
            taken.add(found.getIndex());
            matched.put(step, found);
         });
      }
      return matched;
   }

   /** Microcks names an operation of an OpenAPI contract by its method and path template. */
   private static boolean calls(ArazzoSessionCall call, ExpectedStep step) {
      return step.apiName().equals(call.getServiceName()) && step.apiVersion().equals(call.getServiceVersion())
            && (step.operation().method() + " " + step.operation().path()).equals(call.getOperationName());
   }
}
