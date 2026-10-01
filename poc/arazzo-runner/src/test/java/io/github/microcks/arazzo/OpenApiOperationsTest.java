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

import io.github.microcks.arazzo.OpenApiOperations.Operation;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class OpenApiOperationsTest {

   @Test
   public void indexesOperationsOfEveryHttpMethod() {
      StringBuilder yaml = new StringBuilder("openapi: 3.0.3\npaths:\n  /items:\n");
      for (String method : new String[] { "get", "put", "post", "delete", "options", "head", "patch", "trace" }) {
         yaml.append("    ").append(method).append(": {operationId: ").append(method).append("Items}\n");
      }

      OpenApiOperations operations = OpenApiOperations.parse(yaml.toString());

      assertEquals("", operations.serverUrl());
      assertEquals(new Operation("TRACE", "/items"), operations.operation("traceItems"));
      assertEquals(new Operation("OPTIONS", "/items"), operations.operation("optionsItems"));
      assertTrue(operations.has("deleteItems"));
      assertFalse(operations.has("listItems"));
   }

   @Test
   public void toleratesADescriptionWithoutPaths() {
      assertFalse(OpenApiOperations.parse("openapi: 3.1.0\nwebhooks: {}").has("anything"));
   }

   @Test
   public void rejectsPathItemsThatAreNotObjects() {
      assertEquals("Path item /items must be an object",
            assertThrows(ArazzoException.class, () -> OpenApiOperations.parse("openapi: 3.0.3\npaths:\n  /items: []"))
                  .getMessage());
   }
}
