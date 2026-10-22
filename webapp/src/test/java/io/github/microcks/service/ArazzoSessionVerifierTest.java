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

import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.ArazzoStepOperation;
import io.github.microcks.domain.Header;
import io.github.microcks.service.ArazzoSessionVerifier.ExpectedStep;
import io.github.microcks.util.arazzo.ArazzoOperationCall;
import io.github.microcks.util.arazzo.ArazzoStep;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Tests of what the outputs of a step see of the response the mocks gave to its call: its status, its headers and its
 * body, read as JSON or kept as text.
 * @author SebastienDegodez
 */
class ArazzoSessionVerifierTest {

   @Test
   void theOutputsOfAStepReadTheStatusHeadersAndBodyOfTheResponseOfTheMocks() {
      Map<String, String> outputs = new LinkedHashMap<>();
      outputs.put("status", "$statusCode");
      outputs.put("location", "$response.header.Location");
      outputs.put("receipt", "$response.body");
      ArazzoStep printReceipt = new ArazzoStep("printReceipt", null,
            new ArazzoOperationCall("orderApi", "printReceipt"), List.of(), null, List.of(), outputs, List.of(),
            List.of(), null, null);
      ExpectedStep expected = new ExpectedStep(0, printReceipt,
            new ArazzoStepOperation("orderApi", "printReceipt", "POST", "/receipts", null, null), "Order API", "1.0.0",
            null);
      ArazzoSessionCall call = new ArazzoSessionCall();
      call.setServiceName("Order API");
      call.setServiceVersion("1.0.0");
      call.setOperationName("POST /receipts");
      call.setPath("/receipts");
      call.setResponseStatus(202);
      call.setResponseHeaders(Set.of(new Header("Location", Set.of("/receipts/rc-1"))));
      call.setResponseBody("Receipt of order o-42");

      List<ArazzoSessionVerifier.StepVerdict> verdicts = ArazzoSessionVerifier.verify(List.of(expected), List.of(call),
            null);

      assertEquals(Map.of("status", 202, "location", "/receipts/rc-1", "receipt", "Receipt of order o-42"),
            verdicts.get(0).outputs());
   }
}
