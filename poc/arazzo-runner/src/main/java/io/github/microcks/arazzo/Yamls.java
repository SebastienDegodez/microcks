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

import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Typed access to a YAML or JSON tree loaded as maps and lists. */
final class Yamls {

   private Yamls() {
   }

   static Map<String, Object> load(String content, String what) {
      return map(new Yaml(new SafeConstructor(new LoaderOptions())).load(content), what);
   }

   @SuppressWarnings("unchecked")
   static Map<String, Object> map(Object node, String what) {
      if (node instanceof Map<?, ?> map) {
         return (Map<String, Object>) map;
      }
      throw new ArazzoException(what + " must be an object");
   }

   static Object required(Map<String, Object> node, String field) {
      Object value = node.get(field);
      if (value == null) {
         throw new ArazzoException("Missing required field: " + field);
      }
      return value;
   }

   static String string(Map<String, Object> node, String field) {
      return required(node, field).toString();
   }

   static String optionalString(Map<String, Object> node, String field, String defaultValue) {
      Object value = node.get(field);
      return value == null ? defaultValue : value.toString();
   }

   static List<Map<String, Object>> requiredMaps(Map<String, Object> node, String field) {
      return maps(required(node, field), field);
   }

   static List<Map<String, Object>> optionalMaps(Map<String, Object> node, String field) {
      Object value = node.get(field);
      return value == null ? List.of() : maps(value, field);
   }

   static Map<String, Object> optionalMap(Map<String, Object> node, String field) {
      Object value = node.get(field);
      return value == null ? Map.of() : map(value, field);
   }

   static Map<String, String> optionalStrings(Map<String, Object> node, String field) {
      Map<String, String> strings = new LinkedHashMap<>();
      optionalMap(node, field).forEach((key, value) -> strings.put(key, value.toString()));
      return strings;
   }

   private static List<Map<String, Object>> maps(Object value, String field) {
      if (value instanceof List<?> list) {
         return list.stream().map(item -> map(item, "Each item of " + field)).toList();
      }
      throw new ArazzoException(field + " must be a list");
   }
}
