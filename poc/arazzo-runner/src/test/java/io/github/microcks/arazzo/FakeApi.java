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

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;

/** A real HTTP server answering canned replies, recording every request it receives. */
final class FakeApi implements AutoCloseable {

   record Received(String method, String uri, Map<String, List<String>> headers, String body) {

      String header(String name) {
         return headers.entrySet().stream().filter(e -> e.getKey().equalsIgnoreCase(name))
               .map(e -> e.getValue().get(0)).findFirst().orElse(null);
      }
   }

   record Reply(int status, Map<String, String> headers, String body) {

      static Reply json(int status, String body) {
         return new Reply(status, Map.of("Content-Type", "application/json"), body);
      }
   }

   private final HttpServer server;
   private final List<Received> received = new CopyOnWriteArrayList<>();
   private final Map<String, Function<Received, Reply>> routes = new ConcurrentHashMap<>();

   private FakeApi(HttpServer server) {
      this.server = server;
   }

   static FakeApi start() throws IOException {
      FakeApi api = new FakeApi(HttpServer.create(new InetSocketAddress("localhost", 0), 0));
      api.server.createContext("/", api::handle);
      api.server.start();
      return api;
   }

   FakeApi on(String method, String rawPath, Function<Received, Reply> handler) {
      routes.put(method + " " + rawPath, handler);
      return this;
   }

   FakeApi on(String method, String rawPath, Reply reply) {
      return on(method, rawPath, request -> reply);
   }

   String baseUrl() {
      return "http://localhost:" + server.getAddress().getPort();
   }

   List<Received> received() {
      return received;
   }

   private void handle(HttpExchange exchange) throws IOException {
      Received request = new Received(exchange.getRequestMethod(), exchange.getRequestURI().toString(),
            exchange.getRequestHeaders(),
            new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      received.add(request);
      Reply reply = routes.getOrDefault(request.method() + " " + exchange.getRequestURI().getRawPath(),
            r -> new Reply(404, Map.of(), "")).apply(request);
      reply.headers().forEach((name, value) -> exchange.getResponseHeaders().add(name, value));
      byte[] body = reply.body().getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(reply.status(), body.length == 0 ? -1 : body.length);
      try (OutputStream out = exchange.getResponseBody()) {
         out.write(body);
      }
   }

   @Override
   public void close() {
      server.stop(0);
   }
}
