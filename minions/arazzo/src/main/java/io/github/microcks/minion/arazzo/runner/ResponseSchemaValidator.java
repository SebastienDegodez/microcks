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
import io.github.microcks.util.openapi.OpenAPIResponseValidator;
import io.github.microcks.util.openapi.OpenAPISchemaValidator;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Validates the responses of the steps of a run against the OpenAPI or Swagger contract of their source, with the
 * {@link OpenAPIResponseValidator} OpenAPI contract tests of Microcks use: a JSON response with content is validated
 * against the schema its contract gives for the operation, the status and the content type; any other response is not
 * validated. One validator per run, as it keeps the contracts it has read.
 * @author SebastienDegodez
 */
final class ResponseSchemaValidator {

   private final Map<String, Optional<OpenAPIResponseValidator>> contracts = new HashMap<>();

   /**
    * @param operation The operation a step called
    * @param source    Where the operations of its source are, with their contract
    * @param response  The response the step received
    * @return Why the response does not conform to its contract; empty when it conforms or is not validated
    */
   Optional<String> nonConformance(StepOperation operation, SourceTarget source, HttpOutcome response) {
      String contentType = contentTypeOf(response);
      if (!OpenAPIResponseValidator.isValidated(response.status(), contentType)) {
         return Optional.empty();
      }
      String sourceName = operation.sourceName();
      if (source.openApiContract() == null) {
         return Optional.of("No OpenAPI contract of source " + sourceName + " to validate the response against");
      }
      Optional<OpenAPIResponseValidator> contract = contracts.computeIfAbsent(sourceName,
            name -> read(source.openApiContract()));
      if (contract.isEmpty()) {
         return Optional.of("The OpenAPI contract of source " + sourceName + " cannot be read");
      }
      List<JsonSchemaViolation> violations;
      try {
         violations = contract.get().validate(operation.method(), operation.path(), response.status(), contentType,
               response.body());
      } catch (IOException notJson) {
         return Optional.of("The response body is not JSON");
      }
      Optional<JsonSchemaViolation> undescribed = violations.stream().filter(violation -> violation.pointer() == null)
            .findFirst();
      if (undescribed.isPresent()) {
         return undescribed(undescribed.get(), operation, response.status(), contentType);
      }
      if (violations.isEmpty()) {
         return Optional.empty();
      }
      String schema = schemaNameOf(
            contract.get().schemaOf(operation.method(), operation.path(), response.status(), contentType));
      return Optional.of(violations.stream().sorted(Comparator.comparing(JsonSchemaViolation::pointer))
            .map(violation -> described(violation, schema)).distinct().collect(Collectors.joining("; ")));
   }

   /** Why a response the contract does not describe, or describes without schema, does not conform. */
   private static Optional<String> undescribed(JsonSchemaViolation violation, StepOperation operation, int status,
         String contentType) {
      String notDescribed = " is not described in the OpenAPI contract of " + operation.sourceName();
      return switch (violation.message()) {
         case OpenAPISchemaValidator.MESSAGE_NOT_FOUND ->
            Optional.of("Status " + status + " of " + operation.operationId() + notDescribed);
         case OpenAPISchemaValidator.CONTENT_NOT_FOUND -> Optional.of("Content type " + contentType + " of status "
               + status + " of " + operation.operationId() + notDescribed);
         // A response described without schema accepts any body.
         default -> Optional.empty();
      };
   }

   private static String described(JsonSchemaViolation violation, String schema) {
      String where = violation.pointer().isEmpty() ? "The response body" : violation.pointer();
      return where + " does not match the " + schema + " schema: " + violation.message();
   }

   /** The name of a schema, such as Pastry for #/components/schemas/Pastry. */
   private static String schemaNameOf(JsonNode schema) {
      String reference = schema.path("$ref").asText("");
      return reference.isEmpty() ? "response" : reference.substring(reference.lastIndexOf('/') + 1);
   }

   private static String contentTypeOf(HttpOutcome response) {
      return response.headers().entrySet().stream().filter(header -> header.getKey().equalsIgnoreCase("Content-Type"))
            .flatMap(header -> header.getValue().stream()).findFirst().orElse(null);
   }

   private static Optional<OpenAPIResponseValidator> read(String contract) {
      try {
         return Optional.of(OpenAPIResponseValidator.of(OpenAPISchemaValidator.getJsonNodeForSchema(contract), null));
      } catch (IOException unreadable) {
         return Optional.empty();
      }
   }
}
