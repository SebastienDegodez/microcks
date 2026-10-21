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
package io.github.microcks.web.dto;

import io.github.microcks.domain.Header;
import io.github.microcks.domain.Request;
import io.github.microcks.domain.Response;
import io.github.microcks.domain.WorkflowCriterionResult;
import io.github.microcks.domain.WorkflowExpressionValue;
import io.github.microcks.domain.WorkflowStepOperation;
import io.github.microcks.domain.WorkflowStepResult;
import io.github.microcks.domain.WorkflowStepStatus;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * A step of a run, as the Arazzo minion reports it when the step ends.
 * @param index       The place of the step in the execution order of the run, from 0
 * @param stepId      The id of the step in the workflow
 * @param operation   The operation the step called
 * @param status      PASSED, FAILED or NOT_RUN
 * @param statusCode  The status code of its response; null when none
 * @param elapsedTime How long the step took, in milliseconds
 * @param criteria    Its success criteria, as evaluated
 * @param outputs     Its outputs, by name
 * @param request     The request it sent; null when none
 * @param response    The response it received; null when none
 * @param message     Why it failed when no criterion tells it; null otherwise
 * @author SebastienDegodez
 */
public record ArazzoStepReportDTO(int index, String stepId, Operation operation, String status, Integer statusCode,
      long elapsedTime, List<Criterion> criteria, Map<String, Object> outputs, SentRequest request,
      ReceivedResponse response, String message) {

   /**
    * @param sourceName  The source description
    * @param operationId The operationId
    * @param method      The HTTP method
    * @param path        The path template
    */
   public record Operation(String sourceName, String operationId, String method, String path) {
   }

   /**
    * @param condition The condition of a criterion
    * @param values    The values of its runtime expressions
    * @param held      Whether it held
    */
   public record Criterion(String condition, List<Value> values, boolean held) {
   }

   /**
    * @param expression A runtime expression
    * @param value      Its value
    */
   public record Value(String expression, Object value) {
   }

   /**
    * @param method  The HTTP method of the request
    * @param url     Its full URL
    * @param headers Its headers, by name
    * @param body    Its body; null when none
    */
   public record SentRequest(String method, String url, Map<String, String> headers, String body) {
   }

   /**
    * @param status  The status code of the response
    * @param headers Its headers, by name
    * @param body    Its body
    */
   public record ReceivedResponse(int status, Map<String, List<String>> headers, String body) {
   }

   /** @return The step, as recorded in its run */
   public WorkflowStepResult toStepResult() {
      return new WorkflowStepResult(index, stepId,
            new WorkflowStepOperation(
                  operation.sourceName(), operation.operationId(), operation.method(), operation.path()),
            WorkflowStepStatus.valueOf(status), statusCode, elapsedTime,
            criteria.stream()
                  .map(criterion -> new WorkflowCriterionResult(criterion.condition(),
                        criterion.values().stream()
                              .map(value -> new WorkflowExpressionValue(value.expression(), value.value())).toList(),
                        criterion.held()))
                  .toList(),
            outputs, null, message);
   }

   /** @return The request of the step, as Microcks stores the requests of tests; null when it sent none */
   public Request toRequest() {
      if (request == null) {
         return null;
      }
      Request stored = new Request();
      stored.setName(stepId);
      stored.setContent(request.body());
      Set<Header> headers = new LinkedHashSet<>();
      request.headers().forEach((name, value) -> headers.add(new Header(name, Set.of(value))));
      stored.setHeaders(headers);
      return stored;
   }

   /** @return The response of the step, as Microcks stores the responses of tests; null when it received none */
   public Response toResponse() {
      if (response == null) {
         return null;
      }
      Response stored = new Response();
      stored.setName(stepId);
      stored.setStatus(String.valueOf(response.status()));
      stored.setContent(response.body());
      Set<Header> headers = new LinkedHashSet<>();
      response.headers().forEach((name, values) -> {
         headers.add(new Header(name, new HashSet<>(values)));
         if (name.equalsIgnoreCase("Content-Type")) {
            stored.setMediaType(values.get(0));
         }
      });
      stored.setHeaders(headers);
      return stored;
   }
}
