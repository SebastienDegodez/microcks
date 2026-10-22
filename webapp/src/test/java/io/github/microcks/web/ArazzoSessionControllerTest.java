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
import io.github.microcks.service.ArazzoSessionService;
import io.github.microcks.web.ArazzoSessionController.ArazzoSessionRequest;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.net.URI;
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
   void anOpenedSessionIsCreatedAtItsUrl() {
      ArazzoSession session = new ArazzoSession();
      session.setId("s-1");
      when(arazzoSessionService.openSession("Order saga:1.0.0", "placeOrderSaga")).thenReturn(Optional.of(session));

      ResponseEntity<ArazzoSession> opened = controller
            .openSession(new ArazzoSessionRequest("Order saga:1.0.0", "placeOrderSaga"));

      assertEquals(201, opened.getStatusCode().value());
      assertEquals(URI.create("/api/arazzo/sessions/s-1"), opened.getHeaders().getLocation());
      assertSame(session, opened.getBody());
   }

   @Test
   void noSessionIsOpenedOnAnUnknownDocument() {
      when(arazzoSessionService.openSession("unknown", "placeOrderSaga")).thenReturn(Optional.empty());

      assertEquals(404,
            controller.openSession(new ArazzoSessionRequest("unknown", "placeOrderSaga")).getStatusCode().value());
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
