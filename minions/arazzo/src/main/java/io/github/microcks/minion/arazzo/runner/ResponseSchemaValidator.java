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
package io.github.microcks.minion.arazzo.runner;

import io.github.microcks.util.JsonSchemaViolation;
import io.github.microcks.util.openapi.OpenAPISchemaValidator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;

import java.io.IOException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Validates the responses of the steps of a run against the OpenAPI contract of their source, as the OpenAPI contract
 * tests of Microcks do: a JSON response with content is validated against the schema its contract gives for the
 * operation, the status and the content type; any other response is not validated. One validator per run, as it keeps
 * the contracts it has read.
 * @author SebastienDegodez
 */
final class ResponseSchemaValidator {

   /** The content types OpenAPI contract tests validate, as in the OpenAPI test runner of Microcks. */
   private static final Pattern JSON_TYPES = Pattern.compile("application/(.+\\+)?json");

   private final Map<String, JsonNode> contracts = new HashMap<>();

   /**
    * @param operation The operation a step called
    * @param source    Where the operations of its source are, with their contract
    * @param response  The response the step received
    * @return Why the response does not conform to its contract; empty when it conforms or is not validated
    */
   Optional<String> nonConformance(StepOperation operation, SourceTarget source, HttpOutcome response) {
      String contentType = contentTypeOf(response);
      if (response.status() == 204 || contentType == null || !JSON_TYPES.matcher(mediaTypeOf(contentType)).matches()) {
         return Optional.empty();
      }
      String sourceName = operation.sourceName();
      if (source.openApiContract() == null) {
         return Optional.of("No OpenAPI contract of source " + sourceName + " to validate the response against");
      }
      JsonNode contract = contracts.computeIfAbsent(sourceName, name -> read(source.openApiContract()));
      if (contract.isMissingNode()) {
         return Optional.of("The OpenAPI contract of source " + sourceName + " cannot be read");
      }
      String responsePointer = "/paths/" + escaped(operation.path()) + "/" + operation.method().toLowerCase(Locale.ROOT)
            + "/responses/" + response.status();
      JsonNode described = dereferenced(contract, contract.at(responsePointer));
      String notDescribed = " is not described in the OpenAPI contract of " + sourceName;
      if (described.isMissingNode()) {
         return Optional.of("Status " + response.status() + " of " + operation.operationId() + notDescribed);
      }
      Optional<Map.Entry<String, JsonNode>> content = contentOf(described, contentType);
      if (content.isEmpty()) {
         return Optional.of("Content type " + contentType + " of status " + response.status() + " of "
               + operation.operationId() + notDescribed);
      }
      // A content without schema accepts any body.
      if (!content.get().getValue().has("schema")) {
         return Optional.empty();
      }
      JsonNode body = jsonOf(response.body());
      if (body.isMissingNode()) {
         return Optional.of("The response body is not JSON");
      }
      String schema = schemaNameOf(content.get().getValue());
      // Validated against the content type as the contract writes it, so that the validator finds the same content.
      List<JsonSchemaViolation> violations = OpenAPISchemaValidator.validateJsonMessageWithPointers(contract, body,
            responsePointer, content.get().getKey());
      if (violations.isEmpty()) {
         return Optional.empty();
      }
      return Optional.of(violations.stream().sorted(Comparator.comparing(JsonSchemaViolation::pointer))
            .map(violation -> described(violation, schema)).distinct().collect(Collectors.joining("; ")));
   }

   private static String described(JsonSchemaViolation violation, String schema) {
      String where = violation.pointer().isEmpty() ? "The response body" : violation.pointer();
      return where + " does not match the " + schema + " schema: " + violation.message();
   }

   /** The name of the schema of a content, such as Pastry for #/components/schemas/Pastry. */
   private static String schemaNameOf(JsonNode content) {
      String reference = content.path("schema").path("$ref").asText("");
      return reference.isEmpty() ? "response" : reference.substring(reference.lastIndexOf('/') + 1);
   }

   /** The content of a response for a content type, its parameters such as the charset aside. */
   private static Optional<Map.Entry<String, JsonNode>> contentOf(JsonNode response, String contentType) {
      String mediaType = mediaTypeOf(contentType);
      return response.path("content").properties().stream()
            .filter(content -> mediaTypeOf(content.getKey()).equals(mediaType)).findFirst();
   }

   private static String mediaTypeOf(String contentType) {
      return contentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
   }

   /** A response of the contract, or the one it refers to. */
   private static JsonNode dereferenced(JsonNode contract, JsonNode response) {
      String reference = response.path("$ref").asText("");
      return reference.startsWith("#") ? contract.at(reference.substring(1)) : response;
   }

   private static String contentTypeOf(HttpOutcome response) {
      return response.headers().entrySet().stream().filter(header -> header.getKey().equalsIgnoreCase("Content-Type"))
            .flatMap(header -> header.getValue().stream()).findFirst().orElse(null);
   }

   /** A path as a JSON pointer token: /pastry/{name} is ~1pastry~1{name}. */
   private static String escaped(String path) {
      return path.replace("~", "~0").replace("/", "~1");
   }

   private static JsonNode jsonOf(String body) {
      try {
         return body == null || body.isBlank() ? MissingNode.getInstance() : OpenAPISchemaValidator.getJsonNode(body);
      } catch (IOException notJson) {
         return MissingNode.getInstance();
      }
   }

   private static JsonNode read(String contract) {
      try {
         return OpenAPISchemaValidator.getJsonNodeForSchema(contract);
      } catch (IOException unreadable) {
         return MissingNode.getInstance();
      }
   }
}
