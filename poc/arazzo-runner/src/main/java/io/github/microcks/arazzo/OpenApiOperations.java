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

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Index of the operations of an OpenAPI description, by operationId. */
public final class OpenApiOperations {

   private static final List<String> METHODS = List.of("get", "put", "post", "delete", "options", "head", "patch",
         "trace");

   /** The HTTP method and path template of an operation. */
   public record Operation(String method, String path) {
   }

   private final String serverUrl;
   private final Map<String, Operation> operations = new HashMap<>();

   private OpenApiOperations(String serverUrl) {
      this.serverUrl = serverUrl;
   }

   public static OpenApiOperations parse(String content) {
      Map<String, Object> root = Yamls.load(content, "OpenAPI document");
      List<Map<String, Object>> servers = Yamls.optionalMaps(root, "servers");
      OpenApiOperations index = new OpenApiOperations(servers.isEmpty() ? "" : Yamls.string(servers.get(0), "url"));
      Yamls.optionalMap(root, "paths").forEach((path, item) -> {
         Map<String, Object> pathItem = Yamls.map(item, "Path item " + path);
         for (String method : METHODS) {
            Map<String, Object> operation = Yamls.optionalMap(pathItem, method);
            if (operation.containsKey("operationId")) {
               index.operations.put(Yamls.string(operation, "operationId"),
                     new Operation(method.toUpperCase(Locale.ROOT), path));
            }
         }
      });
      return index;
   }

   public String serverUrl() {
      return serverUrl;
   }

   public boolean has(String operationId) {
      return operations.containsKey(operationId);
   }

   public Operation operation(String operationId) {
      Operation operation = operations.get(operationId);
      if (operation == null) {
         throw new ArazzoException("Unknown operation: " + operationId);
      }
      return operation;
   }
}
