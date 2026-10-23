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
import io.github.microcks.service.ArazzoRunRefusedException;
import io.github.microcks.service.ArazzoSessionService;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Map;

/**
 * Endpoints of the verification sessions of Arazzo workflows: a test opens a session on a workflow, the application it
 * tests calls the mocks naming the session, then the test asks for the verification of the session.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoSessionController {

   private final ArazzoSessionService arazzoSessionService;

   /**
    * Build a new ArazzoSessionController with its dependencies.
    * @param arazzoSessionService to open and verify sessions
    */
   public ArazzoSessionController(ArazzoSessionService arazzoSessionService) {
      this.arazzoSessionService = arazzoSessionService;
   }

   /**
    * The workflow a session is opened on.
    * @param documentId The id of the Arazzo document, or its title and version as {@code <title>:<version>}
    * @param workflowId The id of the workflow in that document
    * @param inputs     The inputs of the workflow whose values the calls must carry, by name; null to check none
    */
   public record ArazzoSessionRequest(String documentId, String workflowId, Map<String, Object> inputs) {
   }

   @PostMapping(value = "/sessions")
   public ResponseEntity<Object> openSession(@RequestBody ArazzoSessionRequest request) {
      try {
         return arazzoSessionService.openSession(request.documentId(), request.workflowId(), request.inputs())
               .<ResponseEntity<Object>>map(session -> ResponseEntity
                     .created(URI.create("/api/arazzo/sessions/" + session.getId())).body(session))
               .orElseGet(() -> ResponseEntity.notFound().build());
      } catch (ArazzoRunRefusedException arre) {
         // The reason is plain text, whatever the client accepts, as the Microcks API describes it.
         return ResponseEntity.badRequest().contentType(MediaType.TEXT_PLAIN).body(arre.getMessage());
      }
   }

   @DeleteMapping(value = "/sessions/{sessionId}")
   public ResponseEntity<Void> closeSession(@PathVariable("sessionId") String sessionId) {
      return arazzoSessionService.closeSession(sessionId) ? ResponseEntity.noContent().build()
            : ResponseEntity.notFound().build();
   }

   @PostMapping(value = "/sessions/{sessionId}/verification")
   public ResponseEntity<WorkflowResult> verify(@PathVariable("sessionId") String sessionId) {
      return ResponseEntity.of(arazzoSessionService.verify(sessionId));
   }
}
