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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Evaluates Arazzo runtime expressions ({@code $inputs.x}, {@code $steps.s.outputs.x}, {@code $statusCode},
 * {@code $response.body#/pointer}, ...) and resolves values that contain them.
 */
public final class ExpressionEvaluator {

   private static final Pattern EMBEDDED = Pattern.compile("\\{(\\$[^{}]+)}");
   private static final String HEADER_PREFIX = "$response.header.";
   private static final String INPUTS_PREFIX = "$inputs.";
   private static final String STEPS_PREFIX = "$steps.";

   /**
    * Resolves a value: a string starting with {@code $} is an expression, other strings may embed expressions as
    * {@code {$expr}}, and maps and lists are resolved recursively into new mutable copies.
    */
   public Object resolve(Object value, EvaluationContext context) {
      if (value instanceof String text) {
         return text.startsWith("$") ? evaluate(text, context) : interpolate(text, context);
      }
      if (value instanceof Map<?, ?> map) {
         Map<String, Object> copy = new LinkedHashMap<>();
         map.forEach((key, item) -> copy.put(key.toString(), resolve(item, context)));
         return copy;
      }
      if (value instanceof List<?> list) {
         return list.stream().map(item -> resolve(item, context)).collect(Collectors.toCollection(ArrayList::new));
      }
      return value;
   }

   public Object evaluate(String expression, EvaluationContext context) {
      String[] parts = expression.split("#", 2);
      Object base = base(parts[0], context);
      return parts.length == 2 ? JsonPointer.get(base, parts[1]) : base;
   }

   private String interpolate(String template, EvaluationContext context) {
      return EMBEDDED.matcher(template)
            .replaceAll(m -> Matcher.quoteReplacement(String.valueOf(evaluate(m.group(1), context))));
   }

   private static Object base(String expression, EvaluationContext context) {
      return switch (expression) {
         case "$statusCode" -> context.response().status();
         case "$method" -> context.request().method();
         case "$url" -> context.request().uri().toString();
         case "$response.body" -> context.responseBody();
         default -> prefixed(expression, context);
      };
   }

   private static Object prefixed(String expression, EvaluationContext context) {
      if (expression.startsWith(HEADER_PREFIX)) {
         return context.responseHeader(expression.substring(HEADER_PREFIX.length()));
      }
      if (expression.startsWith(INPUTS_PREFIX)) {
         return lookup(context.inputs(), expression.substring(INPUTS_PREFIX.length()), "input");
      }
      if (expression.startsWith(STEPS_PREFIX)) {
         String[] parts = expression.substring(STEPS_PREFIX.length()).split("\\.outputs\\.", 2);
         if (parts.length == 2) {
            return lookup(lookup(context.steps(), parts[0], "step"), parts[1], "output");
         }
      }
      throw new ArazzoException("Unsupported runtime expression: " + expression);
   }

   private static <T> T lookup(Map<String, T> values, String key, String kind) {
      if (!values.containsKey(key)) {
         throw new ArazzoException("Unknown " + kind + ": " + key);
      }
      return values.get(key);
   }
}
