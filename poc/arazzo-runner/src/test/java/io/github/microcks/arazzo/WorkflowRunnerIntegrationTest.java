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
package io.github.microcks.arazzo;

import io.github.microcks.arazzo.FakeApi.Received;
import io.github.microcks.arazzo.FakeApi.Reply;
import io.github.microcks.arazzo.Results.StepResult;
import io.github.microcks.arazzo.Results.WorkflowResult;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

/**
 * Runs Arazzo workflows read from files against a real HTTP server: parsing, operation resolution, request building,
 * the JDK transport, criteria and outputs are all exercised together.
 */
public class WorkflowRunnerIntegrationTest {

   private static final ObjectMapper JSON = new ObjectMapper();
   private static final Path PLACE_ORDER = resource("place-order.arazzo.yaml");

   private FakeApi api;

   @Before
   public void startApi() throws Exception {
      api = FakeApi.start();
   }

   @After
   public void stopApi() {
      api.close();
   }

   @Test
   public void chainsCallsAcrossTwoApisUsingOutputsOfPreviousSteps() throws Exception {
      api.on("GET", "/crm/customers/jane%20doe",
            Reply.json(200, "{\"name\":\"Jane Doe\",\"loyalty\":{\"tier\":\"GOLD\"}}"));
      api.on("POST", "/orders", new Reply(201, Map.of("Content-Type", "application/json", "Location", "/orders/o-1"),
            "{\"id\":\"o-1\",\"status\":\"CREATED\"}"));
      api.on("GET", "/orders/o-1", Reply.json(200, "{\"total\":12.5,\"vip\":false}"));
      WorkflowRunner runner = WorkflowRunner.load(PLACE_ORDER, new JdkHttpTransport(),
            Map.of("customerApi", api.baseUrl() + "/crm", "orderApi", api.baseUrl()));

      WorkflowResult result = runner.run("placeOrder", Map.of("customerId", "jane doe", "token", "t0k", "quantity", 3));

      assertTrue(result.success());
      assertNull(result.error());
      assertEquals("placeOrder", result.workflowId());
      assertEquals(Map.of("orderId", "o-1", "total", 12.5, "summary", "Order o-1 placed by Jane Doe"),
            result.outputs());
      assertEquals(List.of(200, 201, 200), result.steps().stream().map(StepResult::statusCode).toList());
      assertEquals(Map.of("name", "Jane Doe", "tier", "GOLD"), result.steps().get(0).outputs());
      assertEquals(Map.of("orderId", "o-1", "location", "/orders/o-1"), result.steps().get(1).outputs());
      String orderUrl = "/orders/o-1?expand=items+%26+totals&currency=EUR";
      assertEquals(Map.of("total", 12.5, "url", api.baseUrl() + orderUrl, "method", "GET"),
            result.steps().get(2).outputs());

      List<Received> received = api.received();
      assertEquals(3, received.size());
      assertEquals("Bearer t0k", received.get(0).header("Authorization"));
      Received createOrder = received.get(1);
      assertEquals("POST", createOrder.method());
      assertEquals("application/json", createOrder.header("Content-Type"));
      assertEquals(JSON.readTree("{\"customer\":\"Jane Doe\",\"items\":[{\"sku\":\"ABC-1\",\"quantity\":3}],"
            + "\"channel\":\"web\",\"pricingTier\":\"GOLD\"}"), JSON.readTree(createOrder.body()));
      assertEquals(orderUrl, received.get(2).uri());
      assertEquals("", received.get(2).body());
   }

   @Test
   public void stopsAtTheFirstStepWhoseCriteriaDoNotHold() {
      api.on("GET", "/customers", Reply.json(200, "{\"count\":0,\"ids\":[]}"));

      WorkflowResult result = runner().run("searchThenRead", Map.of("query", "smith"));

      assertFalse(result.success());
      assertEquals("Step search failed", result.error());
      assertEquals(Map.of(), result.outputs());
      StepResult search = result.steps().get(0);
      assertEquals(1, result.steps().size());
      assertEquals("search", search.stepId());
      assertFalse(search.success());
      assertEquals(Integer.valueOf(200), search.statusCode());
      assertEquals(List.of("$response.body#/count > 0"), search.failedCriteria());
      assertEquals(Map.of(), search.outputs());
      assertNull(search.error());
      assertEquals(List.of("/customers?q=smith"), api.received().stream().map(Received::uri).toList());
   }

   @Test
   public void failsTheStepWhenAnOutputCannotBeExtracted() {
      api.on("GET", "/customers/c1", Reply.json(200, "{\"name\":\"Jane\"}"));

      StepResult step = runner().run("readMissingField", Map.of("customerId", "c1")).steps().get(0);

      assertFalse(step.success());
      assertEquals(Integer.valueOf(200), step.statusCode());
      assertEquals(List.of(), step.failedCriteria());
      assertEquals("No value at JSON pointer: /nickname", step.error());
   }

   @Test
   public void failsTheWorkflowWhenAnOutputOfTheWorkflowCannotBeEvaluated() {
      api.on("GET", "/customers/c1", Reply.json(200, "{}"));

      WorkflowResult result = runner().run("brokenWorkflowOutput", Map.of("customerId", "c1"));

      assertFalse(result.success());
      assertTrue(result.steps().get(0).success());
      assertEquals(Map.of(), result.outputs());
      assertEquals("Unknown step: unknownStep", result.error());
   }

   @Test
   public void sendsTextPayloadsAsTheyAreWithTheirContentType() {
      api.on("PUT", "/orders/42/notes", new Reply(200, Map.of("Content-Type", "text/plain"), "stored"));

      WorkflowResult result = runner().run("storeNote", Map.of("text", "Fragile & $1 urgent"));

      assertTrue(result.success());
      assertEquals(Map.of("stored", "true"), result.outputs());
      Received request = api.received().get(0);
      assertEquals("PUT", request.method());
      assertEquals("application/xml", request.header("Content-Type"));
      assertEquals("<note>Fragile & $1 urgent</note>", request.body());
   }

   @Test
   public void resolvesAnOperationNamedInSeveralSourcesWhenTheSourceIsExplicit() {
      api.on("HEAD", "/ping", new Reply(200, Map.of(), ""));

      WorkflowResult result = runner().run("explicitPing", Map.of());

      assertTrue(result.success());
      assertEquals("HEAD", api.received().get(0).method());
   }

   @Test
   public void reportsOperationsThatCannotBeResolvedWithoutCallingAnything() {
      assertStepError("ambiguousOperation",
            "Operation ping must be defined by exactly one source description, found: [customerApi, orderApi]");
      assertStepError("unknownOperation",
            "Operation deleteEverything must be defined by exactly one source description, found: []");
      assertStepError("unknownSource", "Invalid operation reference: $sourceDescriptions.billingApi.getInvoice");
      assertStepError("incompleteReference", "Invalid operation reference: $sourceDescriptions.customerApi");
      assertStepError("operationOfAnotherSource", "Unknown operation: getCustomer");
      assertEquals(List.of(), api.received());
   }

   @Test
   public void callsTheFirstServerOfTheOpenApiDescriptionByDefault() {
      WorkflowRunner runner = WorkflowRunner.load(PLACE_ORDER, new JdkHttpTransport(), Map.of());

      StepResult step = runner.run("readMissingField", Map.of("customerId", "c1")).steps().get(0);

      assertNull(step.statusCode());
      assertEquals("HTTP call failed: GET http://localhost:1/customer-api/customers/c1", step.error());
   }

   @Test
   public void needsABaseUrlWhenTheOpenApiDescriptionDeclaresNoServer() {
      Path noServer = resource("no-server.arazzo.yaml");
      ArazzoException missing = assertThrows(ArazzoException.class,
            () -> WorkflowRunner.load(noServer, new JdkHttpTransport(), Map.of()));
      assertEquals("No base URL for source description statusApi", missing.getMessage());

      api.on("GET", "/status", Reply.json(200, "{\"up\":true}"));
      WorkflowResult result = WorkflowRunner.load(noServer, new JdkHttpTransport(), Map.of("statusApi", api.baseUrl()))
            .run("readStatus", Map.of());

      assertTrue(result.success());
      assertEquals(Map.of("status", 200), result.steps().get(0).outputs());
   }

   @Test
   public void rejectsUnknownWorkflowsAndUnreadableFiles() {
      WorkflowRunner runner = runner();
      assertEquals("Unknown workflow: nope",
            assertThrows(ArazzoException.class, () -> runner.run("nope", Map.of())).getMessage());
      assertEquals("Cannot read " + resource("none.arazzo.yaml"),
            assertThrows(ArazzoException.class,
                  () -> WorkflowRunner.load(resource("none.arazzo.yaml"), new JdkHttpTransport(), Map.of()))
                        .getMessage());
      assertEquals("Cannot read " + resource("ghost.openapi.yaml"),
            assertThrows(ArazzoException.class,
                  () -> WorkflowRunner.load(resource("missing-source.arazzo.yaml"), new JdkHttpTransport(), Map.of()))
                        .getMessage());
   }

   private void assertStepError(String workflowId, String error) {
      StepResult step = runner().run(workflowId, Map.of()).steps().get(0);
      assertFalse(step.success());
      assertNull(step.statusCode());
      assertEquals(error, step.error());
   }

   private WorkflowRunner runner() {
      return WorkflowRunner.load(PLACE_ORDER, new JdkHttpTransport(),
            Map.of("customerApi", api.baseUrl(), "orderApi", api.baseUrl()));
   }

   private static Path resource(String name) {
      return Path.of("src", "test", "resources", "arazzo", name);
   }
}
