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

import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.Header;
import io.github.microcks.service.ArazzoSessionService;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Records the mock invocations naming a verification session in that session, as the mocks received and answered them.
 * An invocation naming no session is left as it is.
 * @author SebastienDegodez
 */
@Component
public class ArazzoSessionRecorder {

   private final ArazzoSessionService arazzoSessionService;

   /**
    * Build a new ArazzoSessionRecorder with its dependencies.
    * @param arazzoSessionService to record the calls in their session
    */
   public ArazzoSessionRecorder(ArazzoSessionService arazzoSessionService) {
      this.arazzoSessionService = arazzoSessionService;
   }

   /**
    * Record a REST mock invocation in the session it names, if any.
    * @param ic       The service, operation and resource path the invocation was dispatched to
    * @param request  The request of the invocation
    * @param body     The body of the request; null when it has none
    * @param response The response of the mocks
    */
   public void recordRest(MockInvocationContext ic, HttpServletRequest request, String body, ResponseResult response) {
      MockControllerCommons.getArazzoSessionId(request).ifPresent(sessionId -> {
         ArazzoSessionCall call = new ArazzoSessionCall();
         call.setServiceName(ic.service().getName());
         call.setServiceVersion(ic.service().getVersion());
         call.setOperationName(ic.operation().getName());
         call.setMethod(request.getMethod());
         call.setPath(ic.resourcePath());
         call.setRequestUrl(
               request.getRequestURL() + (request.getQueryString() == null ? "" : "?" + request.getQueryString()));
         call.setRequestHeaders(headersOf(request));
         call.setRequestBody(body);
         call.setResponseStatus(response.status().value());
         call.setResponseHeaders(headersOf(response.headers()));
         call.setResponseBody(
               response.content() == null ? null : new String(response.content(), StandardCharsets.UTF_8));
         arazzoSessionService.recordCall(sessionId, call);
      });
   }

   private static Set<Header> headersOf(HttpServletRequest request) {
      Set<Header> headers = new LinkedHashSet<>();
      for (String name : Collections.list(request.getHeaderNames())) {
         headers.add(new Header(name, new HashSet<>(Collections.list(request.getHeaders(name)))));
      }
      return headers;
   }

   private static Set<Header> headersOf(HttpHeaders httpHeaders) {
      Set<Header> headers = new LinkedHashSet<>();
      if (httpHeaders != null) {
         httpHeaders.forEach((name, values) -> headers.add(new Header(name, new HashSet<>(values))));
      }
      return headers;
   }
}
