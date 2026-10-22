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
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.domain.WorkflowRunOrigin;
import io.github.microcks.domain.WorkflowRunSummary;
import io.github.microcks.domain.WorkflowSessionCall;
import io.github.microcks.domain.WorkflowStepResult;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.repository.WorkflowRunFilter;

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
 * Acceptance tests of verifying that an application, an order saga service, followed the workflow placeOrderSaga of
 * Order saga 1.0.0 against the mocks of Order, Stock and Payment API 1.0.0. They enter through the session use case:
 * the test opens a session, the mocks record the calls the service makes in that session, then the test asks for the
 * verification of the session.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoSessionVerificationTest {

   private static final String FIXTURES = "/io/github/microcks/service/arazzo/";
   private static final String SAGA = "placeOrderSaga";

   @Autowired
   private ArazzoSessionService arazzoSessionService;

   @Autowired
   private ArazzoDocumentService arazzoDocumentService;

   @Autowired
   private ArazzoRunHistoryService arazzoRunHistoryService;

   @Autowired
   private ServiceService serviceService;

   /** Walking skeleton: a call the saga service makes in its session is matched to its step, in the history. */
   @Test
   void aCallMadeInTheSessionIsMatchedToItsStepAndTheVerificationJoinsTheHistory() throws Exception {
      ArazzoDocument saga = orderSagaIsImportedAndLinked();
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), SAGA).orElseThrow();

      arazzoSessionService.recordCall(session.getId(), createOrder());

      WorkflowResult verification = arazzoSessionService.verify(session.getId()).orElseThrow();
      assertEquals(WorkflowRunOrigin.SESSION, verification.getOrigin());
      assertEquals(session.getId(), verification.getSession().sessionId());
      WorkflowStepResult createOrder = verification.getSteps().get(0);
      assertEquals("0 createOrder PASSED 201", createOrder.index() + " " + createOrder.stepId() + " "
            + createOrder.status() + " " + createOrder.statusCode());
      assertEquals(List.of(new WorkflowSessionCall(0, "Order API", "1.0.0", "POST", "/orders", "createOrder")),
            verification.getSession().calls());
      List<WorkflowRunSummary> history = arazzoRunHistoryService.getRuns(saga.getId(),
            new WorkflowRunFilter(null, null, null), 0, 20);
      assertEquals(List.of(verification.getId() + " " + WorkflowRunOrigin.SESSION),
            history.stream().map(run -> run.id() + " " + run.origin()).toList());
   }

   /** The order saga service places order o-42 for customer c-7; the mock answers with order o-42. */
   private static ArazzoSessionCall createOrder() {
      return call("Order API", "POST /orders", "/orders",
            "{\"customerId\": \"c-7\", \"items\": [{\"sku\": \"ABC-1\", \"quantity\": 2}], \"amount\": 25.0, "
                  + "\"currency\": \"EUR\"}",
            201, "{\"id\": \"o-42\", \"customerId\": \"c-7\", \"amount\": 25.0, \"status\": \"PENDING\"}");
   }

   /** A call to the mocks of an API 1.0.0, as the mocks record it in a session. */
   private static ArazzoSessionCall call(String apiName, String operationName, String path, String body, int status,
         String responseBody) {
      ArazzoSessionCall call = new ArazzoSessionCall();
      call.setServiceName(apiName);
      call.setServiceVersion("1.0.0");
      call.setOperationName(operationName);
      call.setMethod(operationName.substring(0, operationName.indexOf(' ')));
      call.setPath(path);
      call.setRequestUrl("http://localhost:8080/rest/" + apiName.replace(' ', '+') + "/1.0.0" + path);
      call.setRequestHeaders(Set.of(new Header("Content-Type", Set.of("application/json"))));
      call.setRequestBody(body);
      call.setResponseStatus(status);
      call.setResponseHeaders(Set.of(new Header("Content-Type", Set.of("application/json"))));
      call.setResponseBody(responseBody);
      return call;
   }

   private ArazzoDocument orderSagaIsImportedAndLinked() throws Exception {
      for (String api : List.of("order-api", "stock-api", "payment-api")) {
         Path contract = Files.createTempFile(api, ".yaml");
         Files.writeString(contract, example("order-saga.contracts.yaml", api));
         serviceService.importServiceDefinition(contract.toFile(), null, new ArtifactInfo(api + ".yaml", true));
      }
      arazzoDocumentService.importArazzoSources(example("order-saga.arazzo.yaml", "order-saga-sources"));
      return arazzoDocumentService.importArazzoDocument(example("order-saga.arazzo.yaml", "order-saga"));
   }

   /** One YAML document per example of a fixture, each announced by a {@code # example: <name> - <what>} comment. */
   private static String example(String fixture, String example) throws IOException {
      String marker = "# example: " + example + " ";
      try (InputStream stream = ArazzoSessionVerificationTest.class.getResourceAsStream(FIXTURES + fixture)) {
         return Arrays.stream(new String(stream.readAllBytes(), StandardCharsets.UTF_8).split("\n---\n"))
               .filter(document -> document.startsWith(marker)).findFirst()
               .orElseThrow(() -> new IllegalArgumentException(example + " is not in " + fixture));
      }
   }
}
