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

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** RFC 6901 JSON pointers over trees made of maps and lists. */
final class JsonPointer {

   private JsonPointer() {
   }

   static Object get(Object root, String pointer) {
      Object current = root;
      for (String token : tokens(pointer)) {
         current = child(current, token, pointer);
      }
      return current;
   }

   /** Writes value at pointer in root (which is modified) and returns the resulting tree. */
   @SuppressWarnings("unchecked")
   static Object set(Object root, String pointer, Object value) {
      List<String> tokens = tokens(pointer);
      if (tokens.isEmpty()) {
         return value;
      }
      Object parent = root;
      for (String token : tokens.subList(0, tokens.size() - 1)) {
         parent = child(parent, token, pointer);
      }
      String last = tokens.get(tokens.size() - 1);
      if (parent instanceof Map<?, ?> map) {
         ((Map<String, Object>) map).put(last, value);
      } else if (parent instanceof List<?> list) {
         ((List<Object>) list).set(index(list, last, pointer), value);
      } else {
         throw noValue(pointer);
      }
      return root;
   }

   private static List<String> tokens(String pointer) {
      if (pointer.isEmpty()) {
         return List.of();
      }
      if (!pointer.startsWith("/")) {
         throw new ArazzoException("Invalid JSON pointer: " + pointer);
      }
      return Arrays.stream(pointer.substring(1).split("/", -1)).map(t -> t.replace("~1", "/").replace("~0", "~"))
            .toList();
   }

   private static Object child(Object node, String token, String pointer) {
      if (node instanceof Map<?, ?> map && map.containsKey(token)) {
         return map.get(token);
      }
      if (node instanceof List<?> list) {
         return list.get(index(list, token, pointer));
      }
      throw noValue(pointer);
   }

   private static int index(List<?> list, String token, String pointer) {
      try {
         int index = Integer.parseInt(token);
         if (index >= 0 && index < list.size()) {
            return index;
         }
      } catch (NumberFormatException e) {
         // Not an array index: reported below like any other missing value.
      }
      throw noValue(pointer);
   }

   private static ArazzoException noValue(String pointer) {
      return new ArazzoException("No value at JSON pointer: " + pointer);
   }
}
