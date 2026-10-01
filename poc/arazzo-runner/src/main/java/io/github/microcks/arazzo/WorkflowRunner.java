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

import io.github.microcks.arazzo.HttpTransport.HttpCall;
import io.github.microcks.arazzo.HttpTransport.HttpOutcome;
import io.github.microcks.arazzo.Model.ArazzoDocument;
import io.github.microcks.arazzo.Model.Criterion;
import io.github.microcks.arazzo.Model.Parameter;
import io.github.microcks.arazzo.Model.Replacement;
import io.github.microcks.arazzo.Model.RequestBody;
import io.github.microcks.arazzo.Model.SourceDescription;
import io.github.microcks.arazzo.Model.Step;
import io.github.microcks.arazzo.Model.Workflow;
import io.github.microcks.arazzo.OpenApiOperations.Operation;
import io.github.microcks.arazzo.Results.StepResult;
import io.github.microcks.arazzo.Results.WorkflowResult;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

/**
 * Executes the workflows of an Arazzo document: steps run in order, each one calling its OpenAPI operation, checking
 * its success criteria and exposing its outputs to the following steps. The first failing step ends the workflow.
 */
public final class WorkflowRunner {

   private static final String SOURCE_PREFIX = "$sourceDescriptions.";
   private static final ObjectMapper JSON = new ObjectMapper();

   private final ArazzoDocument document;
   private final Map<String, OpenApiOperations> sources;
   private final Map<String, String> baseUrls;
   private final HttpTransport transport;
   private final ExpressionEvaluator expressions = new ExpressionEvaluator();
   private final ConditionEvaluator conditions = new ConditionEvaluator(expressions);

   private WorkflowRunner(ArazzoDocument document, Map<String, OpenApiOperations> sources, Map<String, String> baseUrls,
         HttpTransport transport) {
      this.document = document;
      this.sources = sources;
      this.baseUrls = baseUrls;
      this.transport = transport;
   }

   /**
    * Loads an Arazzo document and the OpenAPI descriptions it references (paths relative to the document). A base URL
    * given for a source description name replaces the first server URL of that OpenAPI description.
    */
   public static WorkflowRunner load(Path arazzoFile, HttpTransport transport, Map<String, String> baseUrls) {
      ArazzoDocument document = new ArazzoParser().parse(read(arazzoFile));
      Map<String, OpenApiOperations> sources = new LinkedHashMap<>();
      Map<String, String> resolvedBaseUrls = new LinkedHashMap<>();
      for (SourceDescription source : document.sourceDescriptions()) {
         OpenApiOperations operations = OpenApiOperations.parse(read(arazzoFile.resolveSibling(source.url())));
         String baseUrl = baseUrls.getOrDefault(source.name(), operations.serverUrl());
         if (baseUrl.isEmpty()) {
            throw new ArazzoException("No base URL for source description " + source.name());
         }
         sources.put(source.name(), operations);
         resolvedBaseUrls.put(source.name(), baseUrl);
      }
      return new WorkflowRunner(document, sources, resolvedBaseUrls, transport);
   }

   public WorkflowResult run(String workflowId, Map<String, Object> inputs) {
      Workflow workflow = document.workflow(workflowId);
      Map<String, Map<String, Object>> stepOutputs = new LinkedHashMap<>();
      List<StepResult> results = new ArrayList<>();
      for (Step step : workflow.steps()) {
         StepResult result = execute(step, EvaluationContext.of(inputs, stepOutputs));
         results.add(result);
         if (!result.success()) {
            return WorkflowResult.failed(workflowId, results, "Step " + step.stepId() + " failed");
         }
         stepOutputs.put(step.stepId(), result.outputs());
      }
      try {
         Map<String, Object> outputs = evaluateAll(workflow.outputs(), EvaluationContext.of(inputs, stepOutputs));
         return WorkflowResult.succeeded(workflowId, results, outputs);
      } catch (ArazzoException e) {
         return WorkflowResult.failed(workflowId, results, e.getMessage());
      }
   }

   private StepResult execute(Step step, EvaluationContext before) {
      Integer statusCode = null;
      try {
         HttpCall call = call(step, before);
         HttpOutcome outcome = transport.send(call);
         statusCode = outcome.status();
         EvaluationContext after = new EvaluationContext(before.inputs(), before.steps(), call, outcome);
         List<String> failed = new ArrayList<>();
         for (Criterion criterion : step.successCriteria()) {
            if (!conditions.matches(criterion, after)) {
               failed.add(criterion.condition());
            }
         }
         if (!failed.isEmpty()) {
            return StepResult.failed(step.stepId(), statusCode, failed, null);
         }
         return StepResult.succeeded(step.stepId(), statusCode, evaluateAll(step.outputs(), after));
      } catch (ArazzoException e) {
         return StepResult.failed(step.stepId(), statusCode, List.of(), e.getMessage());
      }
   }

   private HttpCall call(Step step, EvaluationContext context) {
      String source = source(step.operationId());
      Operation operation = sources.get(source).operation(operationName(step.operationId()));
      String path = operation.path();
      StringJoiner query = new StringJoiner("&", "?", "").setEmptyValue("");
      Map<String, String> headers = new LinkedHashMap<>();
      for (Parameter parameter : step.parameters()) {
         String value = String.valueOf(expressions.resolve(parameter.value(), context));
         switch (parameter.in()) {
            case "path" -> path = path.replace("{" + parameter.name() + "}", encode(value).replace("+", "%20"));
            case "query" -> query.add(encode(parameter.name()) + "=" + encode(value));
            default -> headers.put(parameter.name(), value);
         }
      }
      String body = null;
      RequestBody requestBody = step.requestBody();
      if (requestBody != null) {
         Object payload = expressions.resolve(requestBody.payload(), context);
         for (Replacement replacement : requestBody.replacements()) {
            payload = JsonPointer.set(payload, replacement.target(), expressions.resolve(replacement.value(), context));
         }
         body = payload instanceof String text ? text : json(payload);
         headers.put("Content-Type", requestBody.contentType());
      }
      return new HttpCall(operation.method(), URI.create(baseUrls.get(source) + path + query), headers, body);
   }

   /** The source description an operationId refers to, either explicitly or as the only one defining it. */
   private String source(String operationId) {
      if (operationId.startsWith(SOURCE_PREFIX)) {
         String[] parts = operationId.substring(SOURCE_PREFIX.length()).split("\\.", 2);
         if (parts.length != 2 || !sources.containsKey(parts[0])) {
            throw new ArazzoException("Invalid operation reference: " + operationId);
         }
         return parts[0];
      }
      List<String> candidates = sources.keySet().stream().filter(name -> sources.get(name).has(operationId)).toList();
      if (candidates.size() != 1) {
         throw new ArazzoException("Operation " + operationId + " must be defined by exactly one source description, "
               + "found: " + candidates);
      }
      return candidates.get(0);
   }

   private static String operationName(String operationId) {
      return operationId.startsWith(SOURCE_PREFIX) ? operationId.substring(operationId.lastIndexOf('.') + 1)
            : operationId;
   }

   private Map<String, Object> evaluateAll(Map<String, String> expressionsByName, EvaluationContext context) {
      Map<String, Object> values = new LinkedHashMap<>();
      expressionsByName.forEach((name, expression) -> values.put(name, expressions.resolve(expression, context)));
      return values;
   }

   private static String encode(String value) {
      return URLEncoder.encode(value, StandardCharsets.UTF_8);
   }

   private static String json(Object payload) {
      try {
         return JSON.writeValueAsString(payload);
      } catch (JsonProcessingException e) {
         throw new ArazzoException("Cannot serialize request payload", e);
      }
   }

   private static String read(Path file) {
      try {
         return Files.readString(file);
      } catch (IOException e) {
         throw new ArazzoException("Cannot read " + file, e);
      }
   }
}
