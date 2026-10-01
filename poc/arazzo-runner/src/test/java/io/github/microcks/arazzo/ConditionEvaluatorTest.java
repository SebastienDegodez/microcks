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
import io.github.microcks.arazzo.Model.Criterion;

import org.junit.Test;

import java.net.URI;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class ConditionEvaluatorTest {

   private static final EvaluationContext CONTEXT = new EvaluationContext(Map.of(), Map.of(),
         new HttpCall("GET", URI.create("http://api/pastry"), Map.of(), null),
         new HttpOutcome(200, Map.of("Content-Type", List.of("application/json; charset=UTF-8")),
               "{\"name\":\"Eclair\",\"price\":2.5,\"available\":true,\"stock\":null}"));

   private final ConditionEvaluator evaluator = new ConditionEvaluator(new ExpressionEvaluator());

   @Test
   public void comparesNumbersWithEveryOperator() {
      String[][] cases = { // operator, results for 1 vs 2, 2 vs 2, 3 vs 2
            { "==", "false", "true", "false" }, { "!=", "true", "false", "true" }, { "<", "true", "false", "false" },
            { "<=", "true", "true", "false" }, { ">", "false", "false", "true" }, { ">=", "false", "true", "true" } };
      for (String[] c : cases) {
         for (int left = 1; left <= 3; left++) {
            String condition = left + " " + c[0] + " 2.0";
            assertEquals(condition, Boolean.parseBoolean(c[left]), evaluate(condition));
         }
      }
   }

   @Test
   public void comparesRuntimeExpressionsWithLiterals() {
      assertTrue(evaluate("$statusCode == 200"));
      assertTrue(evaluate("$response.body#/price < 3"));
      assertTrue(evaluate("$response.body#/name == 'Eclair'"));
      assertFalse(evaluate("$response.body#/name == 'Millefeuille'"));
      assertTrue(evaluate("$response.body#/name != 'Millefeuille'"));
      assertFalse(evaluate("$response.body#/name != 'Eclair'"));
      assertTrue(evaluate("$response.body#/available == true"));
      assertTrue(evaluate("$response.body#/stock == null"));
      assertTrue(evaluate("'a b' == 'a b'"));
      assertFalse(evaluate("'2' == 2"));
   }

   @Test
   public void acceptsBooleanOperandsAlone() {
      assertTrue(evaluate("true"));
      assertFalse(evaluate("false"));
      assertTrue(evaluate("$response.body#/available"));
   }

   @Test
   public void combinesComparisonsWithAndBindingTighterThanOr() {
      assertTrue(evaluate("true && true"));
      assertFalse(evaluate("true && false"));
      assertFalse(evaluate("false && true"));
      assertTrue(evaluate("false || true"));
      assertTrue(evaluate("true || false"));
      assertFalse(evaluate("false || false"));
      assertTrue(evaluate("true || false && false"));
      assertTrue(evaluate("  $statusCode == 200 && $response.body#/price >= 2.5 || false  "));
   }

   @Test
   public void appliesRegexCriteriaToTheirContext() {
      assertTrue(evaluator.matches(new Criterion("json", "regex", "$response.header.content-type"), CONTEXT));
      assertFalse(evaluator.matches(new Criterion("^text/", "regex", "$response.header.Content-Type"), CONTEXT));
      assertTrue(evaluator.matches(new Criterion("$statusCode == 200", "simple", null), CONTEXT));
      assertFalse(evaluator.matches(new Criterion("$statusCode == 404", "simple", null), CONTEXT));
   }

   @Test
   public void rejectsMalformedConditions() {
      for (String condition : List.of("$statusCode = 200", "$statusCode ==", "$statusCode == 200 &&", "true false",
            "200 == abc", "&& true", "'open == 'open'")) {
         assertEquals("Invalid condition: " + condition,
               assertThrows(condition, ArazzoException.class, () -> evaluate(condition)).getMessage());
      }
   }

   @Test
   public void rejectsOperandsThatAreNotBooleansOrNotComparable() {
      assertEquals("Not a boolean: Eclair in condition: $response.body#/name",
            assertThrows(ArazzoException.class, () -> evaluate("$response.body#/name")).getMessage());
      assertEquals("Operator < needs numbers, got: Eclair and 3",
            assertThrows(ArazzoException.class, () -> evaluate("$response.body#/name < 3")).getMessage());
   }

   private boolean evaluate(String condition) {
      return evaluator.evaluate(condition, CONTEXT);
   }
}
