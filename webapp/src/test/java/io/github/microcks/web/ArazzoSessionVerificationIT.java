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
package io.github.microcks.web;

import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.ArazzoSessionCallRepository;
import io.github.microcks.repository.ArazzoSessionRepository;
import io.github.microcks.repository.ArazzoSourcesRepository;
import io.github.microcks.repository.WorkflowResultRepository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * An integration test of an order saga service opens a verification session on placeOrderSaga of Order saga 1.0.0
 * through the Microcks API, the service calls the mocks of Order, Stock and Payment API 1.0.0 naming the session, then
 * the test asks Microcks to verify the session. Every request and response of the Microcks API is checked against the
 * description Microcks publishes of it.
 * @author SebastienDegodez
 */
class ArazzoSessionVerificationIT extends AbstractBaseIT {

   private static final String FIXTURES = "target/test-classes/io/github/microcks/service/arazzo/";
   private static final String SESSIONS = "/arazzo/sessions";
   private static final String SESSION = "/arazzo/sessions/{sessionId}";
   private static final String VERIFICATION = "/arazzo/sessions/{sessionId}/verification";
   private static final String SESSION_HEADER = "x-microcks-session";
   private static final MicrocksApiDescription MICROCKS_API = MicrocksApiDescription.version("1.16");
   private static final ObjectMapper JSON = new ObjectMapper();

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Autowired
   private ArazzoSourcesRepository arazzoSourcesRepository;

   @Autowired
   private WorkflowResultRepository workflowResultRepository;

   @Autowired
   private ArazzoSessionRepository arazzoSessionRepository;

   @Autowired
   private ArazzoSessionCallRepository arazzoSessionCallRepository;

   @TempDir
   private Path uploads;

   @BeforeEach
   void orderSagaIsUploadedAndLinked() throws IOException {
      for (String api : List.of("order-api", "stock-api", "payment-api")) {
         uploadArtifactFile(example("order-saga.contracts.yaml", api), true);
      }
      uploadArtifactFile(example("order-saga.arazzo.yaml", "order-saga"), true);
      uploadArtifactFile(example("order-saga.arazzo.yaml", "order-saga-sources"), false);
   }

   @AfterEach
   void deleteDocumentsSessionsAndVerifications() {
      arazzoDocumentRepository.deleteAll();
      arazzoSourcesRepository.deleteAll();
      workflowResultRepository.deleteAll();
      arazzoSessionRepository.deleteAll();
      arazzoSessionCallRepository.deleteAll();
   }

   /** Walking skeleton: a call naming the session on the mocks is matched to its step by the verification. */
   @Test
   void aMockCallNamingTheSessionIsMatchedToItsStep() throws Exception {
      String sessionId = openSession();

      ResponseEntity<String> placed = callMocks(sessionId, "Order+API", "/orders",
            "{\"customerId\": \"c-7\", \"items\": [{\"sku\": \"ABC-1\", \"quantity\": 2}], \"amount\": 25.0}");

      assertEquals(201, placed.getStatusCode().value(), placed.getBody());
      JsonNode verification = verify(sessionId);
      assertEquals("SESSION", verification.get("origin").asText(), verification.toPrettyString());
      JsonNode createOrder = verification.get("steps").get(0);
      assertEquals("createOrder PASSED 201", createOrder.get("stepId").asText() + " "
            + createOrder.get("status").asText() + " " + createOrder.get("statusCode").asInt());
      JsonNode call = verification.get("session").get("calls").get(0);
      assertEquals("0 Order API POST /orders createOrder",
            call.get("index").asInt() + " " + call.get("apiName").asText() + " " + call.get("method").asText() + " "
                  + call.get("path").asText() + " " + call.get("stepId").asText());
   }

   /** AC-01: the saga service makes the 4 calls of the saga through the mocks; each step is matched in order. */
   @Test
   void theCallsOfTheSagaPassStepByStep() throws Exception {
      String sessionId = openSession();

      placeOrder(sessionId);
      reserveStock(sessionId);
      chargePayment(sessionId);
      confirmOrder(sessionId);

      JsonNode verification = verify(sessionId);
      assertEquals("SUCCESS", verification.get("status").asText(), verification.toPrettyString());
      assertEquals(List.of("createOrder PASSED", "reserveStock PASSED", "chargePayment PASSED", "confirmOrder PASSED"),
            described(verification));
   }

   /** AC-02: the saga service charges the order before reserving its items; the verification fails. */
   @Test
   void aCallOutOfOrderFailsTheVerification() throws Exception {
      String sessionId = openSession();

      placeOrder(sessionId);
      chargePayment(sessionId);
      reserveStock(sessionId);
      confirmOrder(sessionId);

      JsonNode verification = verify(sessionId);
      assertEquals("FAILURE", verification.get("status").asText(), verification.toPrettyString());
      assertEquals(List.of("createOrder PASSED", "reserveStock PASSED", "chargePayment FAILED", "confirmOrder PASSED"),
            described(verification));
      assertEquals("step `reserveStock` expected before `chargePayment`",
            verification.get("steps").get(2).get("message").asText());
   }

   /** AC-03: the saga service reserves the items of order o-1 although the mocks placed o-42. */
   @Test
   void dataNotTakenFromThePreviousStepFailsTheVerification() throws Exception {
      String sessionId = openSession();

      placeOrder(sessionId);
      assertEquals(201, callMocks(sessionId, "Stock+API", "/reservations", "{\"orderId\": \"o-1\", \"items\": []}")
            .getStatusCode().value());
      chargePayment(sessionId);
      confirmOrder(sessionId);

      JsonNode verification = verify(sessionId);
      assertEquals("FAILURE", verification.get("status").asText(), verification.toPrettyString());
      assertEquals("`reserveStock` body `/orderId` should come from `$steps.createOrder.outputs.id` (o-42), got o-1",
            verification.get("steps").get(1).get("message").asText());
   }

   /**
    * AC-05: two tests run the saga at the same time, one naming its session in the header, the other in its W3C
    * baggage; each verification only sees the calls of its own session.
    */
   @Test
   void sessionsAreIsolated() throws Exception {
      String first = openSession();
      String second = openSession();
      String inBaggage = "baggage:tenant=bakery,microcks-session=" + second;

      placeOrder(first);
      placeOrder(inBaggage);
      reserveStock(inBaggage);
      reserveStock(first);
      chargePayment(first);
      chargePayment(inBaggage);
      confirmOrder(inBaggage);
      confirmOrder(first);

      for (String sessionId : List.of(first, second)) {
         JsonNode verification = verify(sessionId);
         assertEquals("SUCCESS", verification.get("status").asText(), verification.toPrettyString());
         assertEquals(4, verification.get("session").get("calls").size(), verification.toPrettyString());
      }
   }

   /** A closed session records no more calls; it can still be verified. */
   @Test
   void aClosedSessionRecordsNoMoreCalls() throws Exception {
      String sessionId = openSession();
      placeOrder(sessionId);

      ResponseEntity<String> closed = restTemplate.exchange("/api" + SESSION, HttpMethod.DELETE,
            new HttpEntity<>(jsonHeaders()), String.class, sessionId);
      MICROCKS_API.assertResponseConforms("DELETE", SESSION, closed);
      assertEquals(204, closed.getStatusCode().value());
      reserveStock(sessionId);

      JsonNode verification = verify(sessionId);
      assertEquals(1, verification.get("session").get("calls").size(), verification.toPrettyString());
   }

   /** A session on an unknown workflow is refused, telling why in plain text. */
   @Test
   void aSessionOnAnUnknownWorkflowIsRefused() throws Exception {
      String body = "{\"documentId\": \"Order saga:1.0.0\", \"workflowId\": \"cancelSaga\"}";
      MICROCKS_API.assertRequestConforms("POST", SESSIONS, body);

      ResponseEntity<String> refused = restTemplate.exchange("/api" + SESSIONS, HttpMethod.POST,
            new HttpEntity<>(body, jsonHeaders()), String.class);

      MICROCKS_API.assertResponseConforms("POST", SESSIONS, refused);
      assertEquals(400, refused.getStatusCode().value());
      assertEquals("Unknown workflow: cancelSaga", refused.getBody());
   }

   private void placeOrder(String sessionId) {
      assertEquals(201,
            callMocks(sessionId, "Order+API", "/orders",
                  "{\"customerId\": \"c-7\", \"items\": [{\"sku\": \"ABC-1\", \"quantity\": 2}], \"amount\": 25.0}")
                        .getStatusCode().value());
   }

   private void reserveStock(String sessionId) {
      assertEquals(201, callMocks(sessionId, "Stock+API", "/reservations", "{\"orderId\": \"o-42\", \"items\": []}")
            .getStatusCode().value());
   }

   private void chargePayment(String sessionId) {
      assertEquals(201, callMocks(sessionId, "Payment+API", "/payments", "{\"orderId\": \"o-42\", \"amount\": 25.0}")
            .getStatusCode().value());
   }

   private void confirmOrder(String sessionId) {
      assertEquals(200, callMocks(sessionId, "Order+API", "/orders/o-42/confirm", null).getStatusCode().value());
   }

   private static List<String> described(JsonNode verification) {
      List<String> steps = new ArrayList<>();
      verification.get("steps")
            .forEach(step -> steps.add(step.get("stepId").asText() + " " + step.get("status").asText()));
      return steps;
   }

   /** Open a session on placeOrderSaga as a test does, checking the exchange against the published API. */
   private String openSession() throws Exception {
      String body = "{\"documentId\": \"Order saga:1.0.0\", \"workflowId\": \"placeOrderSaga\"}";
      MICROCKS_API.assertRequestConforms("POST", SESSIONS, body);
      ResponseEntity<String> opened = restTemplate.exchange("/api" + SESSIONS, HttpMethod.POST,
            new HttpEntity<>(body, jsonHeaders()), String.class);
      MICROCKS_API.assertResponseConforms("POST", SESSIONS, opened);
      assertEquals(201, opened.getStatusCode().value(), opened.getBody());
      String sessionId = JSON.readTree(opened.getBody()).get("id").asText();
      assertEquals("/api/arazzo/sessions/" + sessionId, opened.getHeaders().getLocation().toString());
      return sessionId;
   }

   /** Verify a session as a test does, checking the response against the published API. */
   private JsonNode verify(String sessionId) throws Exception {
      ResponseEntity<String> verified = restTemplate.exchange("/api" + VERIFICATION, HttpMethod.POST,
            new HttpEntity<>(jsonHeaders()), String.class, sessionId);
      MICROCKS_API.assertResponseConforms("POST", VERIFICATION, verified);
      assertEquals(200, verified.getStatusCode().value(), verified.getBody());
      return JSON.readTree(verified.getBody());
   }

   /**
    * The saga service calls the mocks of an API 1.0.0, naming its session in the x-microcks-session header, or in the
    * baggage header when written as {@code baggage:<baggage>}.
    */
   private ResponseEntity<String> callMocks(String session, String api, String path, String body) {
      HttpHeaders headers = jsonHeaders();
      if (session.startsWith("baggage:")) {
         headers.add("baggage", session.substring("baggage:".length()));
      } else {
         headers.add(SESSION_HEADER, session);
      }
      return restTemplate.exchange("/rest/" + api + "/1.0.0" + path, HttpMethod.POST, new HttpEntity<>(body, headers),
            String.class);
   }

   private static HttpHeaders jsonHeaders() {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.APPLICATION_JSON);
      headers.setAccept(List.of(MediaType.APPLICATION_JSON));
      return headers;
   }

   /** Writes the example of a multi-document fixture to its own file, as the API developer would upload it. */
   private String example(String fixture, String example) throws IOException {
      String marker = "# example: " + example + " ";
      String document = Arrays.stream(Files.readString(Path.of(FIXTURES + fixture)).split("\n---\n"))
            .filter(candidate -> candidate.contains(marker)).findFirst().orElseThrow();
      Path file = uploads.resolve(example + (fixture.contains("arazzo") ? ".arazzo.yaml" : ".yaml"));
      Files.writeString(file, document, StandardCharsets.UTF_8);
      return file.toString();
   }
}
