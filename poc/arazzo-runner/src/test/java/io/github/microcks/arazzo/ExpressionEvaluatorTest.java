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

import org.junit.Test;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

public class ExpressionEvaluatorTest {

   private static final Map<String, Object> INPUTS = Map.of("name", "Eclair", "price", 2.5, "address",
         Map.of("city", "Lille"));
   private static final Map<String, Map<String, Object>> STEPS = Map.of("list", Map.of("first", "Baba"));
   private static final EvaluationContext CONTEXT = new EvaluationContext(INPUTS, STEPS,
         new HttpCall("PATCH", URI.create("http://api/pastry/Eclair"), Map.of(), "{}"),
         new HttpOutcome(201, Map.of("X-Trace", List.of("t-1", "t-2")), "[{\"id\":7}]"));

   private final ExpressionEvaluator evaluator = new ExpressionEvaluator();

   @Test
   public void evaluatesEachKindOfRuntimeExpression() {
      assertEquals(201, evaluator.evaluate("$statusCode", CONTEXT));
      assertEquals("PATCH", evaluator.evaluate("$method", CONTEXT));
      assertEquals("http://api/pastry/Eclair", evaluator.evaluate("$url", CONTEXT));
      assertEquals(List.of(Map.of("id", 7)), evaluator.evaluate("$response.body", CONTEXT));
      assertEquals(7, evaluator.evaluate("$response.body#/0/id", CONTEXT));
      assertEquals("t-1", evaluator.evaluate("$response.header.x-trace", CONTEXT));
      assertEquals(2.5, evaluator.evaluate("$inputs.price", CONTEXT));
      assertEquals("Lille", evaluator.evaluate("$inputs.address#/city", CONTEXT));
      assertEquals("Baba", evaluator.evaluate("$steps.list.outputs.first", CONTEXT));
   }

   @Test
   public void keepsNonJsonBodiesAsText() {
      EvaluationContext text = new EvaluationContext(Map.of(), Map.of(), null,
            new HttpOutcome(200, Map.of(), "<pastry/>"));
      assertEquals("<pastry/>", evaluator.evaluate("$response.body", text));
   }

   @Test
   public void resolvesNestedValuesIntoMutableCopies() {
      Map<String, Object> template = Map.of("label", "{$inputs.name} costs {$inputs.price}", "tags",
            List.of("$inputs.name", 3), "plain", "no expression");

      Object resolved = evaluator.resolve(template, CONTEXT);

      assertEquals(Map.of("label", "Eclair costs 2.5", "tags", List.of("Eclair", 3), "plain", "no expression"),
            resolved);
      assertEquals(LinkedHashMap.class, resolved.getClass());
      assertEquals(ArrayList.class, ((Map<?, ?>) resolved).get("tags").getClass());
      assertEquals(Arrays.asList(1, null, true), evaluator.resolve(Arrays.asList(1, null, true), CONTEXT));
   }

   @Test
   public void reportsWhatCannotBeEvaluated() {
      EvaluationContext beforeCall = EvaluationContext.of(INPUTS, STEPS);
      assertError("No response available in this context", "$statusCode", beforeCall);
      assertError("No request available in this context", "$method", beforeCall);
      assertError("Missing response header: X-Missing", "$response.header.X-Missing", CONTEXT);
      assertError("Unknown input: missing", "$inputs.missing", CONTEXT);
      assertError("Unknown step: missing", "$steps.missing.outputs.first", CONTEXT);
      assertError("Unknown output: missing", "$steps.list.outputs.missing", CONTEXT);
      assertError("Unsupported runtime expression: $steps.list", "$steps.list", CONTEXT);
      assertError("Unsupported runtime expression: $request.body", "$request.body", CONTEXT);
   }

   private void assertError(String message, String expression, EvaluationContext context) {
      assertEquals(message,
            assertThrows(ArazzoException.class, () -> evaluator.evaluate(expression, context)).getMessage());
   }
}
