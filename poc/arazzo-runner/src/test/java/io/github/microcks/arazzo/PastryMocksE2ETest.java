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

import io.github.microcks.arazzo.Results.StepResult;
import io.github.microcks.arazzo.Results.WorkflowResult;

import org.junit.Assume;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

/**
 * Plays Arazzo workflows against the mocks a running Microcks serves for the API Pastry sample. Needs the URL of a
 * Microcks instance in the MICROCKS_URL environment variable; skipped otherwise.
 */
public class PastryMocksE2ETest {

   private static final String MICROCKS_URL = System.getenv("MICROCKS_URL");
   private static final Path PASTRY_OPENAPI = Path.of("..", "..", "samples", "APIPastry-openapi.yaml");
   private static final Path PASTRY_WORKFLOWS = Path.of("src", "test", "resources", "arazzo", "pastry.arazzo.yaml");

   private static WorkflowRunner runner;

   @BeforeClass
   public static void importThePastryApiIntoMicrocks() throws Exception {
      Assume.assumeTrue("MICROCKS_URL is not set", MICROCKS_URL != null);
      String boundary = "arazzo-poc-" + System.nanoTime();
      ByteArrayOutputStream body = new ByteArrayOutputStream();
      body.writeBytes(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; "
            + "filename=\"APIPastry-openapi.yaml\"\r\nContent-Type: application/octet-stream\r\n\r\n")
                  .getBytes(StandardCharsets.UTF_8));
      body.writeBytes(Files.readAllBytes(PASTRY_OPENAPI));
      body.writeBytes(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
      HttpRequest upload = HttpRequest.newBuilder(URI.create(MICROCKS_URL + "/api/artifact/upload?mainArtifact=true"))
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
      HttpResponse<String> response = HttpClient.newHttpClient().send(upload, HttpResponse.BodyHandlers.ofString());
      assertEquals(response.body(), 201, response.statusCode());

      runner = WorkflowRunner.load(PASTRY_WORKFLOWS, new JdkHttpTransport(),
            Map.of("pastryApi", MICROCKS_URL + "/rest/API+Pastry+-+2.0/2.0.0"));
   }

   @Test
   public void chainsCallsOnConsistentMocks() {
      WorkflowResult result = runner.run("readThenReprice", Map.of("pastry", "Eclair Cafe", "newPrice", 2.6));

      assertTrue(String.valueOf(result), result.success());
      assertEquals(Map.of("before", 2.5, "after", 2.6), result.outputs());
   }

   @Test
   public void detectsMockExamplesThatDoNotFormACoherentScenario() {
      WorkflowResult result = runner.run("listThenReadFirst", Map.of());

      assertFalse(String.valueOf(result), result.success());
      assertEquals(List.of(true, false), result.steps().stream().map(StepResult::success).toList());
      assertEquals(Map.of("first", "Baba Rhum"), result.steps().get(0).outputs());
      StepResult readFirst = result.steps().get(1);
      assertNotEquals(Integer.valueOf(200), readFirst.statusCode());
      assertEquals(List.of("$statusCode == 200"), readFirst.failedCriteria());
   }
}
