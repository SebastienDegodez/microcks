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

import io.github.microcks.domain.ArazzoSession;
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.service.ArazzoRunRefusedException;
import io.github.microcks.service.ArazzoSessionService;
import io.github.microcks.web.ArazzoSessionController.ArazzoSessionRequest;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.net.URI;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Tests of the session endpoints as a test calls them, on the session use case.
 * @author SebastienDegodez
 */
class ArazzoSessionControllerTest {

   private final ArazzoSessionService arazzoSessionService = mock(ArazzoSessionService.class);
   private final ArazzoSessionController controller = new ArazzoSessionController(arazzoSessionService);

   @Test
   void anOpenedSessionIsCreatedAtItsUrl() throws Exception {
      ArazzoSession session = new ArazzoSession();
      session.setId("s-1");
      when(arazzoSessionService.openSession("Order saga:1.0.0", "placeOrderSaga", Map.of("customerId", "c-7"),
            Map.of())).thenReturn(Optional.of(session));

      ResponseEntity<Object> opened = controller
            .openSession(new ArazzoSessionRequest("Order saga:1.0.0", "placeOrderSaga", Map.of("customerId", "c-7")));

      assertEquals(201, opened.getStatusCode().value());
      assertEquals(URI.create("/api/arazzo/sessions/s-1"), opened.getHeaders().getLocation());
      assertSame(session, opened.getBody());
   }

   @Test
   void aSessionIsOpenedWithTheStepsItSetsToFail() throws Exception {
      ArazzoSession session = new ArazzoSession();
      session.setId("s-2");
      Map<String, String> failures = Map.of("chargePayment", "card refused");
      when(arazzoSessionService.openSession("Order saga:1.0.0", "compensatePaymentRefused", null, failures))
            .thenReturn(Optional.of(session));

      ResponseEntity<Object> opened = controller
            .openSession(new ArazzoSessionRequest("Order saga:1.0.0", "compensatePaymentRefused", null, failures));

      assertEquals(201, opened.getStatusCode().value());
      assertSame(session, opened.getBody());
   }

   @Test
   void noSessionIsOpenedOnAnUnknownDocument() throws Exception {
      when(arazzoSessionService.openSession("unknown", "placeOrderSaga", null, Map.of())).thenReturn(Optional.empty());

      assertEquals(404, controller.openSession(new ArazzoSessionRequest("unknown", "placeOrderSaga", null))
            .getStatusCode().value());
   }

   @Test
   void aRefusedSessionIsABadRequestTellingWhyInPlainText() throws Exception {
      when(arazzoSessionService.openSession("Order saga:1.0.0", "cancelSaga", null, Map.of()))
            .thenThrow(new ArazzoRunRefusedException("Unknown workflow: cancelSaga"));

      ResponseEntity<Object> refused = controller
            .openSession(new ArazzoSessionRequest("Order saga:1.0.0", "cancelSaga", null));

      assertEquals(400, refused.getStatusCode().value());
      assertEquals(MediaType.TEXT_PLAIN, refused.getHeaders().getContentType());
      assertEquals("Unknown workflow: cancelSaga", refused.getBody());
   }

   @Test
   void aClosedSessionHasNoContentAndAnUnknownSessionIsNotFound() {
      when(arazzoSessionService.closeSession("s-1")).thenReturn(true);

      assertEquals(204, controller.closeSession("s-1").getStatusCode().value());
      assertEquals(404, controller.closeSession("unknown").getStatusCode().value());
   }

   @Test
   void theVerificationOfASessionIsReturnedAndAnUnknownSessionIsNotFound() {
      WorkflowResult verification = new WorkflowResult();
      when(arazzoSessionService.verify("s-1")).thenReturn(Optional.of(verification));
      when(arazzoSessionService.verify("unknown")).thenReturn(Optional.empty());

      ResponseEntity<WorkflowResult> verified = controller.verify("s-1");

      assertEquals(200, verified.getStatusCode().value());
      assertSame(verification, verified.getBody());
      assertEquals(404, controller.verify("unknown").getStatusCode().value());
   }
}
