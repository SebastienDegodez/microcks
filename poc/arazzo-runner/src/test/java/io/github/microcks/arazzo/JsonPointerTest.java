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

import org.junit.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;

public class JsonPointerTest {

   private static final Map<String, Object> DOCUMENT = Map.of("a/b", 1, "m~n", 2, "list", List.of("x", "y"), "nested",
         Map.of("deep", "value"));

   @Test
   public void readsValuesThroughObjectsAndArrays() {
      assertSame(DOCUMENT, JsonPointer.get(DOCUMENT, ""));
      assertEquals(1, JsonPointer.get(DOCUMENT, "/a~1b"));
      assertEquals(2, JsonPointer.get(DOCUMENT, "/m~0n"));
      assertEquals("x", JsonPointer.get(DOCUMENT, "/list/0"));
      assertEquals("y", JsonPointer.get(DOCUMENT, "/list/1"));
      assertEquals("value", JsonPointer.get(DOCUMENT, "/nested/deep"));
   }

   @Test
   public void reportsMissingValues() {
      for (String pointer : List.of("/missing", "/list/2", "/list/-1", "/list/first", "/nested/deep/deeper")) {
         assertEquals("No value at JSON pointer: " + pointer,
               assertThrows(pointer, ArazzoException.class, () -> JsonPointer.get(DOCUMENT, pointer)).getMessage());
      }
      assertEquals("Invalid JSON pointer: list",
            assertThrows(ArazzoException.class, () -> JsonPointer.get(DOCUMENT, "list")).getMessage());
   }

   @Test
   public void writesValuesIntoObjectsAndArrays() {
      Map<String, Object> items = new LinkedHashMap<>(Map.of("quantity", 1));
      Map<String, Object> payload = new LinkedHashMap<>(Map.of("items", new ArrayList<>(List.of(items, "b"))));

      assertSame(payload, JsonPointer.set(payload, "/items/0/quantity", 3));
      assertSame(payload, JsonPointer.set(payload, "/items/1", "c"));
      assertSame(payload, JsonPointer.set(payload, "/tier", "GOLD"));

      assertEquals(Map.of("items", List.of(Map.of("quantity", 3), "c"), "tier", "GOLD"), payload);
      assertEquals("whole", JsonPointer.set(payload, "", "whole"));
   }

   @Test
   public void refusesToWriteWhereThereIsNoContainer() {
      Map<String, Object> payload = new LinkedHashMap<>(Map.of("name", "Eclair", "list", new ArrayList<>()));
      for (String pointer : List.of("/name/first", "/missing/first", "/list/0")) {
         assertEquals("No value at JSON pointer: " + pointer,
               assertThrows(pointer, ArazzoException.class, () -> JsonPointer.set(payload, pointer, "x")).getMessage());
      }
   }
}
