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

import io.github.microcks.repository.ResourceRepository;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.util.tracing.CommonEvents;

import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import io.opentelemetry.sdk.trace.ReadWriteSpan;
import io.opentelemetry.sdk.trace.ReadableSpan;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.SpanProcessor;
import io.opentelemetry.sdk.trace.data.EventData;
import io.opentelemetry.sdk.trace.data.SpanData;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

/**
 * Acceptance tests of S29 on the side of the mocks: a REST mock invocation whose W3C baggage says it comes from an
 * Arazzo run records which run, workflow, step and attempt on its span and on its invocation_received event, which Live
 * Traces show. Any other baggage, or none, leaves the invocation as it was; a malformed one is ignored.
 * @author SebastienDegodez
 */
class RestControllerLiveTracesTest {

   private static final String RUN_OF_READ_PASTRY = "arazzo.attempt=2, arazzo.run.id=6719f0c2a1b2c3d4e5f60718, "
         + "arazzo.step.id=readPastry, arazzo.via=run, arazzo.workflow.id=readThenReprice";

   private final List<SpanData> ended = new ArrayList<>();
   private final SdkTracerProvider tracerProvider = SdkTracerProvider.builder().addSpanProcessor(new SpanProcessor() {
      @Override
      public void onStart(Context parentContext, ReadWriteSpan span) {
         // Only ended spans are looked at.
      }

      @Override
      public boolean isStartRequired() {
         return false;
      }

      @Override
      public void onEnd(ReadableSpan span) {
         ended.add(span.toSpanData());
      }

      @Override
      public boolean isEndRequired() {
         return true;
      }
   }).build();
   private final RestController controller = new RestController(mock(ServiceRepository.class),
         mock(ResourceRepository.class), mock(RestInvocationProcessor.class));

   @AfterEach
   void closeTracerProvider() {
      tracerProvider.close();
   }

   @ParameterizedTest
   @CsvSource(delimiter = '|', nullValues = "null", value = {
         // The baggage of a call of the minion.
         "microcks-arazzo-run=6719f0c2a1b2c3d4e5f60718,microcks-arazzo-workflow=readThenReprice,"
               + "microcks-arazzo-step=readPastry,microcks-arazzo-attempt=2 | " + RUN_OF_READ_PASTRY,
         // The entries of the run after those of the step itself, with spaces and properties.
         "tenant=bakery , microcks-arazzo-run = 6719f0c2a1b2c3d4e5f60718;origin=minion, "
               + "microcks-arazzo-workflow=readThenReprice,microcks-arazzo-step=readPastry,microcks-arazzo-attempt=2 | "
               + RUN_OF_READ_PASTRY,
         // Percent-encoded values.
         "microcks-arazzo-run=run%201,microcks-arazzo-workflow=read%20pastry%3Bfast,microcks-arazzo-step=read%2Conce,"
               + "microcks-arazzo-attempt=1 | arazzo.attempt=1, arazzo.run.id=run 1, arazzo.step.id=read,once, "
               + "arazzo.via=run, arazzo.workflow.id=read pastry;fast",
         // A run without the other entries is still a run.
         "microcks-arazzo-run=6719f0c2a1b2c3d4e5f60718 | arazzo.run.id=6719f0c2a1b2c3d4e5f60718, arazzo.via=run",
         // An attempt that is not a positive number is left out.
         "microcks-arazzo-run=r1,microcks-arazzo-attempt=two | arazzo.run.id=r1, arazzo.via=run",
         "microcks-arazzo-run=r1,microcks-arazzo-attempt=0 | arazzo.run.id=r1, arazzo.via=run",
         // An unrelated baggage, or none: nothing.
         "tenant=bakery,userId=alice | ''", "null | ''",
         // Entries of a workflow without a run: nothing.
         "microcks-arazzo-workflow=readThenReprice,microcks-arazzo-step=readPastry | ''",
         // Malformed baggages are ignored.
         "microcks-arazzo-run | ''", "'=,;;=' | ''", "microcks-arazzo-run= | ''" })
   void aMockInvocationTellsLiveTracesTheArazzoRunItsBaggageNames(String baggage, String attributes) {
      HttpHeaders headers = new HttpHeaders();
      if (baggage != null) {
         headers.add("baggage", baggage);
      }

      ResponseEntity<byte[]> response = invoke(headers);

      assertEquals(404, response.getStatusCode().value());
      SpanData span = ended.getFirst();
      assertEquals(attributes, arazzo(span.getAttributes()));
      assertEquals(attributes, arazzo(invocationReceived(span).getAttributes()));
   }

   @Test
   void theRunIsReadAcrossSeveralBaggageHeaders() {
      HttpHeaders headers = new HttpHeaders();
      headers.add("baggage", "tenant=bakery");
      headers.add("Baggage", "microcks-arazzo-run=r1,microcks-arazzo-workflow=w1");

      invoke(headers);

      assertEquals("arazzo.run.id=r1, arazzo.via=run, arazzo.workflow.id=w1", arazzo(ended.getFirst().getAttributes()));
   }

   /** A REST invocation of a service Microcks does not know, within a span as the server instrumentation opens. */
   private ResponseEntity<byte[]> invoke(HttpHeaders headers) {
      MockHttpServletRequest request = new MockHttpServletRequest("GET", "/rest/API+Pastry+-+2.0/2.0.0/pastry");
      headers.forEach((name, values) -> values.forEach(value -> request.addHeader(name, value)));
      Span span = tracerProvider.get("test").spanBuilder("GET /rest/{service}/{version}/**").startSpan();
      try (Scope scope = span.makeCurrent()) {
         return controller.execute("API+Pastry+-+2.0", "2.0.0", null, null, null, headers, request, HttpMethod.GET);
      } finally {
         span.end();
      }
   }

   private static EventData invocationReceived(SpanData span) {
      return span.getEvents().stream()
            .filter(event -> event.getName().equals(CommonEvents.INVOCATION_RECEIVED.getEventName())).findFirst()
            .orElseThrow();
   }

   /** The Arazzo attributes, sorted by key. */
   private static String arazzo(Attributes attributes) {
      return attributes.asMap().entrySet().stream().filter(entry -> entry.getKey().getKey().startsWith("arazzo."))
            .map(entry -> entry.getKey().getKey() + "=" + entry.getValue()).sorted().collect(Collectors.joining(", "));
   }
}
