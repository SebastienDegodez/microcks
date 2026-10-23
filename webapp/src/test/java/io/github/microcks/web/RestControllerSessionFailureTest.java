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

import io.github.microcks.domain.Operation;
import io.github.microcks.domain.Response;
import io.github.microcks.domain.Service;
import io.github.microcks.repository.ResourceRepository;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.service.ArazzoSessionFailures;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests of a REST mock invocation in a verification session that sets its operation to fail: it is answered with the
 * chosen example instead of being dispatched, and recorded with that answer; otherwise it is dispatched as usual.
 * @author SebastienDegodez
 */
class RestControllerSessionFailureTest {

   private static final String CHARGE = "{\"orderId\": \"o-42\", \"amount\": 25.0}";

   private final ServiceRepository serviceRepository = mock(ServiceRepository.class);
   private final RestInvocationProcessor invocationProcessor = mock(RestInvocationProcessor.class);
   private final ArazzoSessionRecorder arazzoSessionRecorder = mock(ArazzoSessionRecorder.class);
   private final ArazzoSessionFailures arazzoSessionFailures = mock(ArazzoSessionFailures.class);
   private final RestController controller = new RestController(serviceRepository, mock(ResourceRepository.class),
         invocationProcessor, arazzoSessionRecorder, arazzoSessionFailures);
   private final Service payment = new Service();
   private final ResponseResult charged = answer(HttpStatus.CREATED, "{\"status\": \"CHARGED\"}");
   private final ResponseResult refused = answer(HttpStatus.PAYMENT_REQUIRED, "{\"status\": \"REFUSED\"}");

   @BeforeEach
   void paymentApiIsMocked() {
      payment.setName("Payment API");
      payment.setVersion("1.0.0");
      Operation chargePayment = new Operation();
      chargePayment.setName("POST /payments");
      chargePayment.setMethod("POST");
      payment.setOperations(List.of(chargePayment));
      when(serviceRepository.findByNameAndVersion("Payment API", "1.0.0")).thenReturn(payment);
      when(invocationProcessor.processInvocation(any(), anyLong(), any(), eq(CHARGE), any(), any()))
            .thenReturn(charged);
   }

   @Test
   void aStepTheSessionSetsToFailAnswersWithItsExampleAndIsRecordedSo() {
      Response cardRefused = new Response();
      when(arazzoSessionFailures.injectedFailure(eq("s-1"), same(payment), any())).thenReturn(Optional.of(cardRefused));
      when(invocationProcessor.processInjectedFailure(any(), anyLong(), any(), eq(CHARGE), any(), same(cardRefused)))
            .thenReturn(refused);
      MockHttpServletRequest request = chargePayment();
      request.addHeader("x-microcks-session", "s-1");

      ResponseEntity<byte[]> answered = invoke(request);

      assertEquals(List.of(402, "{\"status\": \"REFUSED\"}"),
            List.of(answered.getStatusCode().value(), new String(answered.getBody(), StandardCharsets.UTF_8)));
      verify(invocationProcessor, never()).processInvocation(any(), anyLong(), any(), any(), any(), any());
      verify(arazzoSessionRecorder).recordRest(any(), same(request), eq(CHARGE), same(refused));
   }

   @Test
   void anInvocationNamingNoSessionIsDispatchedAsUsual() {
      when(arazzoSessionFailures.injectedFailure(isNull(), same(payment), any())).thenReturn(Optional.empty());
      MockHttpServletRequest request = chargePayment();

      ResponseEntity<byte[]> answered = invoke(request);

      assertEquals(201, answered.getStatusCode().value());
      verify(arazzoSessionRecorder).recordRest(any(), same(request), eq(CHARGE), same(charged));
   }

   private ResponseEntity<byte[]> invoke(MockHttpServletRequest request) {
      HttpHeaders headers = new HttpHeaders();
      return controller.execute("Payment+API", "1.0.0", null, null, CHARGE, headers, request, HttpMethod.POST);
   }

   private static MockHttpServletRequest chargePayment() {
      return new MockHttpServletRequest("POST", "/rest/Payment+API/1.0.0/payments");
   }

   private static ResponseResult answer(HttpStatus status, String body) {
      return new ResponseResult(status, new HttpHeaders(), body.getBytes(StandardCharsets.UTF_8));
   }
}
