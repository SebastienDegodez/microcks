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

import io.github.microcks.arazzo.FakeApi.Reply;
import io.github.microcks.arazzo.HttpTransport.HttpCall;

import org.junit.Test;

import java.net.URI;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public class JdkHttpTransportIntegrationTest {

   @Test
   public void keepsTheThreadInterruptedWhenACallIsInterrupted() throws Exception {
      try (FakeApi api = FakeApi.start()) {
         api.on("GET", "/slow", request -> {
            sleep();
            return new Reply(200, Map.of(), "late");
         });
         HttpCall call = new HttpCall("GET", URI.create(api.baseUrl() + "/slow"), Map.of(), null);

         Thread.currentThread().interrupt();
         ArazzoException error = assertThrows(ArazzoException.class, () -> new JdkHttpTransport().send(call));

         assertTrue(Thread.interrupted());
         assertEquals("HTTP call interrupted: GET " + call.uri(), error.getMessage());
      }
   }

   private static void sleep() {
      try {
         Thread.sleep(1_000);
      } catch (InterruptedException e) {
         Thread.currentThread().interrupt();
      }
   }
}
