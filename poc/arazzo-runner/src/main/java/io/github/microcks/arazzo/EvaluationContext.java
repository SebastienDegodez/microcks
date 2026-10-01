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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * What runtime expressions can see: workflow inputs, outputs of previous steps and, once a step has been called, its
 * request and response.
 */
public record EvaluationContext(Map<String, Object> inputs, Map<String, Map<String, Object>> steps, HttpCall request,
      HttpOutcome response) {

   private static final ObjectMapper JSON = new ObjectMapper();

   /** A context before any call: only inputs and step outputs are available. */
   public static EvaluationContext of(Map<String, Object> inputs, Map<String, Map<String, Object>> steps) {
      return new EvaluationContext(inputs, steps, null, null);
   }

   @Override
   public HttpCall request() {
      if (request == null) {
         throw new ArazzoException("No request available in this context");
      }
      return request;
   }

   @Override
   public HttpOutcome response() {
      if (response == null) {
         throw new ArazzoException("No response available in this context");
      }
      return response;
   }

   /** The response body parsed as JSON, or the raw text when it is not JSON. */
   Object responseBody() {
      String body = response().body();
      try {
         return JSON.readValue(body, Object.class);
      } catch (JsonProcessingException e) {
         return body;
      }
   }

   String responseHeader(String name) {
      return response().headers().entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase(name))
            .map(e -> e.getValue().get(0)).findFirst()
            .orElseThrow(() -> new ArazzoException("Missing response header: " + name));
   }
}
