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

import java.util.Map;

/**
 * A run of an Arazzo workflow, as Microcks posts it to the Arazzo minion. The minion has its own model of a run: only
 * this request and the reports it posts back cross the boundary.
 * @param runId          The id of the run, to report its steps and its end to
 * @param workflowId     The workflow to run
 * @param arazzoDocument The Arazzo document, as imported
 * @param inputs         The inputs of the workflow, by name
 * @param sources        Where to call the operations of each linked source description, by source name
 * @param timeoutMS      How long a step waits for its response, in milliseconds
 * @author SebastienDegodez
 */
public record ArazzoRunRequest(String runId, String workflowId, String arazzoDocument, Map<String, Object> inputs,
      Map<String, Source> sources, long timeoutMS) {

   /**
    * Where to call the operations of a source description.
    * @param baseUrl    The base URL of the operations: relative to Microcks for its mocks
    * @param operations The method and path of each operation of the linked API, by operationId
    */
   public record Source(String baseUrl, Map<String, Operation> operations) {
   }

   /**
    * @param method The HTTP method of an operation
    * @param path   Its path template
    */
   public record Operation(String method, String path) {
   }
}
