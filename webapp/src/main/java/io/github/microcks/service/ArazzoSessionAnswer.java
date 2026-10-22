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
package io.github.microcks.service;

import io.github.microcks.domain.Request;
import io.github.microcks.util.arazzo.ArazzoReceivedRequest;
import io.github.microcks.util.arazzo.ArazzoStep;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Fills the example a step of a workflow answers with, in a session, with the values of the session. The example pairs
 * a request with its response: the steps reads in reverse where each value it sends goes in the request, the example
 * request holds a value there, and the places of the example response holding that same value receive the value of the
 * session.
 * @author SebastienDegodez
 */
final class ArazzoSessionAnswer {

   private static final ObjectMapper JSON = new ObjectMapper();

   private ArazzoSessionAnswer() {
   }

   /**
    * @param step     The step the call is answered for
    * @param example  The request of the example the mocks answer with
    * @param received The request the mocks received for the step
    * @return The value of the session each value of the example request is replaced with, by the text of the example
    *         value
    */
   static Map<String, Object> replacements(ArazzoStep step, Request example, ArazzoReceivedRequest received) {
      Map<String, Object> replacements = new LinkedHashMap<>();
      if (step.requestBody() != null && example != null) {
         ArazzoReceivedRequest exampleRequest = new ArazzoReceivedRequest("", "", null, Map.of(), example.getContent());
         step.requestBody().replacements().keySet()
               .forEach(target -> exampleRequest.bodyValue(target).ifPresent(exampleValue -> received.bodyValue(target)
                     .ifPresent(value -> replacements.put(String.valueOf(exampleValue), value))));
      }
      return replacements;
   }

   /**
    * @param body         The body of the example response
    * @param replacements The value each value of the example is replaced with, by the text of the example value
    * @return The body with the values replaced; the body as it is when it is not JSON or holds none of these values
    */
   static String filled(String body, Map<String, Object> replacements) {
      JsonNode tree;
      try {
         tree = JSON.readTree(body);
      } catch (IllegalArgumentException | JsonProcessingException notJson) {
         return body;
      }
      return replace(tree, replacements) ? tree.toString() : body;
   }

   /** Replace the scalar values of a JSON tree in place; whether one was. */
   private static boolean replace(JsonNode node, Map<String, Object> replacements) {
      boolean replaced = false;
      if (node instanceof ObjectNode object) {
         for (Map.Entry<String, JsonNode> member : object.properties()) {
            JsonNode value = member.getValue();
            if (value.isValueNode() && replacements.containsKey(value.asText())) {
               member.setValue(JSON.valueToTree(replacements.get(value.asText())));
               replaced = true;
            } else {
               replaced |= replace(value, replacements);
            }
         }
      } else if (node instanceof ArrayNode array) {
         for (int index = 0; index < array.size(); index++) {
            JsonNode item = array.get(index);
            if (item.isValueNode() && replacements.containsKey(item.asText())) {
               array.set(index, JSON.valueToTree(replacements.get(item.asText())));
               replaced = true;
            } else {
               replaced |= replace(item, replacements);
            }
         }
      }
      return replaced;
   }
}
