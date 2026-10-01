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

import io.github.microcks.arazzo.Model.Criterion;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Evaluates success criteria. Simple conditions support literals (numbers, quoted strings, booleans, null), runtime
 * expressions, the comparison operators {@code == != < <= > >=} and their combination with {@code &&} and {@code ||}.
 * Regex criteria apply their pattern to the value of their context expression.
 */
public final class ConditionEvaluator {

   private static final Pattern TOKEN = Pattern.compile("\\s*('[^']*'|&&|\\|\\||==|!=|<=|>=|<|>|[^\\s=!<>&|']+)");
   private static final Set<String> COMPARATORS = Set.of("==", "!=", "<", "<=", ">", ">=");

   private final ExpressionEvaluator expressions;

   public ConditionEvaluator(ExpressionEvaluator expressions) {
      this.expressions = expressions;
   }

   public boolean matches(Criterion criterion, EvaluationContext context) {
      if (criterion.type().equals("regex")) {
         Object subject = expressions.evaluate(criterion.context(), context);
         return Pattern.compile(criterion.condition()).matcher(String.valueOf(subject)).find();
      }
      return evaluate(criterion.condition(), context);
   }

   public boolean evaluate(String condition, EvaluationContext context) {
      Cursor cursor = new Cursor(tokenize(condition), condition);
      boolean result = or(cursor, context);
      if (cursor.hasNext()) {
         throw cursor.invalid();
      }
      return result;
   }

   private boolean or(Cursor cursor, EvaluationContext context) {
      boolean result = and(cursor, context);
      while (cursor.accept("||")) {
         result = and(cursor, context) | result;
      }
      return result;
   }

   private boolean and(Cursor cursor, EvaluationContext context) {
      boolean result = comparison(cursor, context);
      while (cursor.accept("&&")) {
         result = comparison(cursor, context) & result;
      }
      return result;
   }

   private boolean comparison(Cursor cursor, EvaluationContext context) {
      Object left = operand(cursor, context);
      if (!cursor.nextIsComparator()) {
         if (left instanceof Boolean value) {
            return value;
         }
         throw new ArazzoException("Not a boolean: " + left + " in condition: " + cursor.condition);
      }
      String operator = cursor.next();
      return compare(left, operator, operand(cursor, context));
   }

   private Object operand(Cursor cursor, EvaluationContext context) {
      String token = cursor.next();
      if (token.startsWith("'")) {
         return token.substring(1, token.length() - 1);
      }
      if (token.startsWith("$")) {
         return expressions.evaluate(token, context);
      }
      if (token.equals("true") || token.equals("false")) {
         return Boolean.valueOf(token);
      }
      if (token.equals("null")) {
         return null;
      }
      try {
         return new BigDecimal(token);
      } catch (NumberFormatException e) {
         throw cursor.invalid();
      }
   }

   private static boolean compare(Object left, String operator, Object right) {
      if (left instanceof Number l && right instanceof Number r) {
         return holds(operator, new BigDecimal(l.toString()).compareTo(new BigDecimal(r.toString())));
      }
      if (operator.equals("==")) {
         return Objects.equals(left, right);
      }
      if (operator.equals("!=")) {
         return !Objects.equals(left, right);
      }
      throw new ArazzoException("Operator " + operator + " needs numbers, got: " + left + " and " + right);
   }

   private static boolean holds(String operator, int comparison) {
      return switch (operator) {
         case "==" -> comparison == 0;
         case "!=" -> comparison != 0;
         case "<" -> comparison < 0;
         case "<=" -> comparison <= 0;
         case ">" -> comparison > 0;
         default -> comparison >= 0;
      };
   }

   private static List<String> tokenize(String condition) {
      String text = condition.strip();
      List<String> tokens = new ArrayList<>();
      Matcher matcher = TOKEN.matcher(text);
      int position = 0;
      while (position < text.length()) {
         matcher.region(position, text.length());
         if (!matcher.lookingAt()) {
            throw new ArazzoException("Invalid condition: " + condition);
         }
         tokens.add(matcher.group(1));
         position = matcher.end();
      }
      return tokens;
   }

   private static final class Cursor {

      private final List<String> tokens;
      private final String condition;
      private int index;

      Cursor(List<String> tokens, String condition) {
         this.tokens = tokens;
         this.condition = condition;
      }

      boolean hasNext() {
         return index < tokens.size();
      }

      String next() {
         if (!hasNext()) {
            throw invalid();
         }
         return tokens.get(index++);
      }

      boolean accept(String token) {
         if (hasNext() && tokens.get(index).equals(token)) {
            index++;
            return true;
         }
         return false;
      }

      boolean nextIsComparator() {
         return hasNext() && COMPARATORS.contains(tokens.get(index));
      }

      ArazzoException invalid() {
         return new ArazzoException("Invalid condition: " + condition);
      }
   }
}
