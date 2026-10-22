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
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.repository.ResponseRepository;
import io.github.microcks.repository.ServiceRepository;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
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
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

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

   /** Walking skeleton, AC-02: the order reserveStock receives flows into the reservation the mock answers. */
   @Test
   void theValuesAStepReceivesFlowIntoItsAnswer() throws Exception {
      ArazzoSession session = sessionOnTheSaga();

      Response answer = arazzoSessionAnswerService
            .answer(session.getId(), reserveStock("o-42"), dispatched("Stock API", "POST /reservations")).orElseThrow();

      assertJson("{\"id\": \"r-9\", \"orderId\": \"o-42\"}", answer.getContent());
      assertEquals("201", answer.getStatus());
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
