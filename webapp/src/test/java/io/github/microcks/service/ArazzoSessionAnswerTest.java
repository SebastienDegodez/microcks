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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.ArazzoSession;
import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.Header;
import io.github.microcks.domain.Response;
import io.github.microcks.domain.Service;
import io.github.microcks.domain.ServiceState;
import io.github.microcks.repository.ArazzoSessionRepository;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.repository.ResponseRepository;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.repository.ServiceStateRepository;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Acceptance tests of the mocks answering an order saga service consistently along the workflow placeOrderSaga of Order
 * saga 1.0.0, in a session: the examples of Order, Stock and Payment API 1.0.0 were written for order o-1, but the mock
 * placed order o-42 in the session. They enter through the use case deciding the answer of the mocks to a call made in
 * a session.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoSessionAnswerTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";
   private static final String SAGA = "placeOrderSaga";
   private static final ObjectMapper JSON = new ObjectMapper();

   @Autowired
   private ArazzoSessionService arazzoSessionService;

   @Autowired
   private ArazzoSessionAnswerService arazzoSessionAnswerService;

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ServiceService serviceService;

   @Autowired
   private ServiceRepository serviceRepository;

   @Autowired
   private ResponseRepository responseRepository;

   @Autowired
   private ServiceStateRepository serviceStateRepository;

   @Autowired
   private ArazzoSessionRepository arazzoSessionRepository;

   /** Walking skeleton, AC-02: the order reserveStock receives flows into the reservation the mock answers. */
   @Test
   void theValuesAStepReceivesFlowIntoItsAnswer() throws Exception {
      ArazzoSession session = sessionOnTheSaga();

      Response answer = arazzoSessionAnswerService
            .answer(session.getId(), reserveStock("o-42"), dispatched("Stock API", "POST /reservations")).orElseThrow();

      assertJson("{\"id\": \"r-9\", \"orderId\": \"o-42\"}", answer.getContent());
      assertEquals("201", answer.getStatus());
   }

   /**
    * AC-01: createOrder placed o-42 in the session; the mocks have no example for o-42, yet they confirm o-42 with the
    * example of confirmOrder, written for o-1.
    */
   @Test
   void aLaterStepAnswersWithTheOutputOfAnEarlierStep() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      mocksAnswer(session, createOrder(), dispatched("Order API", "POST /orders"));

      Response answer = arazzoSessionAnswerService.answer(session.getId(), confirmOrder("o-42"), null).orElseThrow();

      assertJson("{\"id\": \"o-42\", \"customerId\": \"c-7\", \"amount\": 25.0, \"status\": \"CONFIRMED\"}",
            answer.getContent());
      assertEquals(List.of("200", "application/json"), List.of(answer.getStatus(), answer.getMediaType()));
   }

   /** A value a step does not send is taken from the outputs of the earlier steps of the session. */
   @Test
   void aValueAStepDoesNotSendIsTakenFromTheSession() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      mocksAnswer(session, createOrder(), dispatched("Order API", "POST /orders"));

      Response answer = arazzoSessionAnswerService
            .answer(session.getId(), received("Payment API", "POST /payments", "/payments", "{\"amount\": 25.0}"),
                  dispatched("Payment API", "POST /payments"))
            .orElseThrow();

      assertJson("{\"id\": \"p-3\", \"orderId\": \"o-42\", \"status\": \"CHARGED\"}", answer.getContent());
   }

   /**
    * The mocks play the workflow: the value an earlier step of the session gave wins over the value the service sends,
    * which the verification of the session reports.
    */
   @Test
   void theValuesOfTheSessionWinOverThoseTheServiceSends() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      mocksAnswer(session, createOrder(), dispatched("Order API", "POST /orders"));

      Response answer = arazzoSessionAnswerService
            .answer(session.getId(), reserveStock("o-7"), dispatched("Stock API", "POST /reservations")).orElseThrow();

      assertJson("{\"id\": \"r-9\", \"orderId\": \"o-42\"}", answer.getContent());
   }

   /** AC-03: a call naming no open session, or matching no step of its workflow, is answered as it is today. */
   @ParameterizedTest(name = "{0}")
   @CsvSource({ "an unknown session, unknown, POST /orders/{orderId}/confirm",
         "a closed session, closed, POST /orders/{orderId}/confirm",
         "an operation no step calls, open, GET /orders/{orderId}" })
   void aCallOutsideTheWorkflowOfAnOpenSessionIsAnsweredAsToday(String what, String session, String operation)
         throws Exception {
      ArazzoSession opened = sessionOnTheSaga();
      String sessionId = switch (session) {
         case "unknown" -> "s-unknown";
         case "closed" -> {
            arazzoSessionService.closeSession(opened.getId());
            yield opened.getId();
         }
         default -> opened.getId();
      };

      assertEquals(Optional.empty(), arazzoSessionAnswerService.answer(sessionId,
            received("Order API", operation, "/orders/o-42/confirm", null), null));
   }

   /** An operation without example has nothing to answer with: the mocks answer as they do today. */
   @Test
   void anOperationWithoutExampleIsAnsweredAsToday() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      responseRepository.delete(dispatched("Order API", "POST /orders/{orderId}/confirm"));

      assertEquals(Optional.empty(), arazzoSessionAnswerService.answer(session.getId(), confirmOrder("o-42"), null));
   }

   /** A step called again in the session answers again with the values of the session. */
   @Test
   void aStepCalledAgainAnswersTheSameWay() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      mocksAnswer(session, createOrder(), dispatched("Order API", "POST /orders"));
      mocksAnswer(session, confirmOrder("o-42"), null);

      Response again = arazzoSessionAnswerService.answer(session.getId(), confirmOrder("o-42"), null).orElseThrow();

      assertEquals("o-42", JSON.readTree(again.getContent()).get("id").asText(), again.getContent());
   }

   /** Each session has its own state: the order another session placed does not flow into this one. */
   @Test
   void theStateOfASessionIsItsOwn() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      ArazzoSession another = arazzoSessionService.openSession(session.getDocumentId(), SAGA).orElseThrow();
      mocksAnswer(another, createOrder(), dispatched("Order API", "POST /orders"));

      Response answer = arazzoSessionAnswerService
            .answer(session.getId(), received("Payment API", "POST /payments", "/payments", "{\"amount\": 25.0}"),
                  dispatched("Payment API", "POST /payments"))
            .orElseThrow();

      assertJson("{\"id\": \"p-3\", \"orderId\": \"o-1\", \"status\": \"CHARGED\"}", answer.getContent());
   }

   /**
    * The outputs of a step the mocks answered are kept in the state store of the API that answered it, under a key of
    * the session, and expire with the session, even once closing it moved its expiry.
    */
   @Test
   void theStateOfASessionIsKeptByTheApiThatAnsweredAndExpiresWithTheSession() throws Exception {
      ArazzoSession session = sessionOnTheSaga();
      mocksAnswer(session, createOrder(), dispatched("Order API", "POST /orders"));
      Service orderApi = serviceRepository.findByNameAndVersion("Order API", "1.0.0");
      String key = "arazzo-session:" + session.getId() + ":createOrder";

      ServiceState state = serviceStateRepository.findByServiceIdAndKey(orderApi.getId(), key);
      assertEquals(Map.of("id", "o-42", "amount", 25.0), JSON.readValue(state.getValue(), Map.class));
      assertExpiresWith(session, state);

      arazzoSessionService.closeSession(session.getId());

      assertExpiresWith(arazzoSessionRepository.findById(session.getId()).orElseThrow(),
            serviceStateRepository.findByServiceIdAndKey(orderApi.getId(), key));
   }

   /** The state store keeps a value for a number of seconds: the state expires in the last second of the session. */
   private static void assertExpiresWith(ArazzoSession session, ServiceState state) {
      long before = session.getExpireAt().getTime() - state.getExpireAt().getTime();
      assertTrue(before >= 0 && before <= 1000, () -> "the state expires " + before + " ms before the session");
   }

   private ArazzoSession sessionOnTheSaga() throws Exception {
      ArazzoDocument saga = orderSagaIsImportedAndLinked();
      return arazzoSessionService.openSession(saga.getId(), SAGA).orElseThrow();
   }

   /** The example of an operation, as the mocks of an API 1.0.0 dispatch it. */
   private Response dispatched(String apiName, String operationName) {
      Service api = serviceRepository.findByNameAndVersion(apiName, "1.0.0");
      return responseRepository.findByOperationId(api.getId() + "-" + operationName).get(0);
   }

   /**
    * The mocks answer a call in a session, then record it there with their answer, as they do for a REST call.
    * @return The answer
    */
   private Response mocksAnswer(ArazzoSession session, ArazzoSessionCall call, Response dispatched) {
      Response answer = arazzoSessionAnswerService.answer(session.getId(), call, dispatched).orElse(dispatched);
      call.setResponseStatus(Integer.parseInt(answer.getStatus()));
      call.setResponseHeaders(Set.of(new Header("Content-Type", Set.of(answer.getMediaType()))));
      call.setResponseBody(answer.getContent());
      arazzoSessionService.recordCall(session.getId(), call);
      return answer;
   }

   /** The order saga service places an order for customer c-7. */
   private static ArazzoSessionCall createOrder() {
      return received("Order API", "POST /orders", "/orders",
            "{\"customerId\": \"c-7\", \"items\": [{\"sku\": \"ABC-1\", \"quantity\": 2}], \"amount\": 25.0, "
                  + "\"currency\": \"EUR\"}");
   }

   /** The order saga service confirms an order. */
   private static ArazzoSessionCall confirmOrder(String orderId) {
      return received("Order API", "POST /orders/{orderId}/confirm", "/orders/" + orderId + "/confirm", null);
   }

   /** The order saga service reserves the items of an order. */
   private static ArazzoSessionCall reserveStock(String orderId) {
      return received("Stock API", "POST /reservations", "/reservations",
            "{\"orderId\": \"" + orderId + "\", \"items\": [{\"sku\": \"ABC-1\", \"quantity\": 2}]}");
   }

   /** A call the mocks of an API 1.0.0 receive in a session, before they answer it. */
   private static ArazzoSessionCall received(String apiName, String operationName, String path, String body) {
      ArazzoSessionCall call = new ArazzoSessionCall();
      call.setServiceName(apiName);
      call.setServiceVersion("1.0.0");
      call.setOperationName(operationName);
      call.setMethod(operationName.substring(0, operationName.indexOf(' ')));
      call.setPath(path);
      call.setRequestUrl("http://localhost:8080/rest/" + apiName.replace(' ', '+') + "/1.0.0" + path);
      call.setRequestHeaders(Set.of(new Header("Content-Type", Set.of("application/json"))));
      call.setRequestBody(body);
      return call;
   }

   private static void assertJson(String expected, String actual) throws IOException {
      assertEquals(JSON.readTree(expected), JSON.readTree(actual), actual);
   }

   private ArazzoDocument orderSagaIsImportedAndLinked() throws Exception {
      for (String api : List.of("order-api", "stock-api", "payment-api")) {
         Path contract = Files.createTempFile(api, ".yaml");
         Files.writeString(contract, example("stateful-saga.contracts.yaml", api));
         serviceService.importServiceDefinition(contract.toFile(), null, new ArtifactInfo(api + ".yaml", true));
      }
      arazzoDocumentService.importArazzoSources(example("order-saga.arazzo.yaml", "order-saga-sources"));
      return arazzoDocumentService.importArazzoDocument(example("order-saga.arazzo.yaml", "order-saga"));
   }

   /** One YAML document per example of a fixture, each announced by a {@code # example: <name> - <what>} comment. */
   private static String example(String fixture, String example) throws IOException {
      String marker = "# example: " + example + " ";
      try (InputStream stream = ArazzoSessionAnswerTest.class.getResourceAsStream(FIXTURES + fixture)) {
         return Arrays.stream(new String(stream.readAllBytes(), StandardCharsets.UTF_8).split("\n---\n"))
               .filter(document -> document.startsWith(marker)).findFirst()
               .orElseThrow(() -> new IllegalArgumentException(example + " is not in " + fixture));
      }
   }
}
