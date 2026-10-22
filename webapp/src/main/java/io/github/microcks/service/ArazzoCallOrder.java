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
import io.github.microcks.service.ArazzoSessionVerifier.ExpectedStep;

import java.util.Map;
import java.util.Optional;

/**
 * The order a verification expects the calls matched to the steps of a workflow in. Matching a call to a step does not
 * depend on it: the order is checked once every step has its call.
 * @author SebastienDegodez
 */
@FunctionalInterface
interface ArazzoCallOrder {

   /**
    * Strict order: each step is expected after every step before it in the workflow. A call received before the call of
    * an earlier step is out of order, and names the first such earlier step.
    */
   ArazzoCallOrder STRICT = (step, call, calls) -> calls.entrySet().stream()
         .filter(earlier -> earlier.getKey().index() < step.index() && earlier.getValue().getIndex() > call.getIndex())
         .map(earlier -> "step `" + earlier.getKey().step().stepId() + "` expected before `" + step.step().stepId()
               + "`")
         .findFirst();

   /**
    * @param step  A step matched to a call
    * @param call  The call matched to it
    * @param calls The call matched to each step that has one, in the order of the workflow
    * @return Why the call of the step is out of order; empty when it is in order
    */
   Optional<String> violation(ExpectedStep step, ArazzoSessionCall call, Map<ExpectedStep, ArazzoSessionCall> calls);
}
