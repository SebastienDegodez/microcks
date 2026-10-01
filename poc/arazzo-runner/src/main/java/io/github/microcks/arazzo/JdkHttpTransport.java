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

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;

/** {@link HttpTransport} backed by the JDK HTTP client. */
public final class JdkHttpTransport implements HttpTransport {

   private final HttpClient client = HttpClient.newHttpClient();

   @Override
   public HttpOutcome send(HttpCall call) {
      HttpRequest.Builder request = HttpRequest.newBuilder(call.uri()).method(call.method(),
            call.body() == null ? BodyPublishers.noBody() : BodyPublishers.ofString(call.body()));
      call.headers().forEach(request::header);
      try {
         HttpResponse<String> response = client.send(request.build(), BodyHandlers.ofString());
         return new HttpOutcome(response.statusCode(), response.headers().map(), response.body());
      } catch (IOException e) {
         throw new ArazzoException("HTTP call failed: " + call.method() + " " + call.uri(), e);
      } catch (InterruptedException e) {
         Thread.currentThread().interrupt();
         throw new ArazzoException("HTTP call interrupted: " + call.method() + " " + call.uri(), e);
      }
   }
}
