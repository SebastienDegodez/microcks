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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.ArazzoSession;
import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.ArazzoStepCall;
import io.github.microcks.domain.Request;
import io.github.microcks.domain.Response;
import io.github.microcks.repository.ArazzoSessionRepository;
import io.github.microcks.repository.RequestRepository;
import io.github.microcks.service.ArazzoDocumentService.ResolvedSource;
import io.github.microcks.service.ArazzoSessionVerifier.ExpectedStep;
import io.github.microcks.util.arazzo.ArazzoStep;
import io.github.microcks.util.arazzo.ArazzoWorkflow;
import io.github.microcks.util.arazzo.ArazzoWorkflowReader;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Service bean deciding how the mocks answer a call made in an Arazzo verification session: the step of the workflow
 * the call matches answers with its example, filled with the values of the session.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoSessionAnswerService {

   private final ArazzoDocumentService arazzoDocumentService;
   private final ArazzoSessionRepository arazzoSessionRepository;
   private final RequestRepository requestRepository;

   /**
    * Build a new ArazzoSessionAnswerService with its required dependencies.
    * @param arazzoDocumentService   The service finding the Arazzo documents and linking their sources to APIs
    * @param arazzoSessionRepository The repository of the sessions
    * @param requestRepository       The repository of the requests of the examples
    */
   public ArazzoSessionAnswerService(ArazzoDocumentService arazzoDocumentService,
         ArazzoSessionRepository arazzoSessionRepository, RequestRepository requestRepository) {
      this.arazzoDocumentService = arazzoDocumentService;
      this.arazzoSessionRepository = arazzoSessionRepository;
      this.requestRepository = requestRepository;
   }

   /**
    * @param sessionId  The id of the session the call names
    * @param received   The call, as the mocks received it
    * @param dispatched The response the mocks dispatched to the call; null when they found none
    * @return The answer of the session to the call; empty when the mocks answer as they do outside a session
    */
   public Optional<Response> answer(String sessionId, ArazzoSessionCall received, Response dispatched) {
      Optional<ArazzoSession> session = arazzoSessionRepository.findById(sessionId);
      if (session.isEmpty()) {
         return Optional.empty();
      }
      Optional<ArazzoDocument> document = arazzoDocumentService.getDocument(session.get().getDocumentId());
      if (document.isEmpty()) {
         return Optional.empty();
      }
      Optional<ExpectedStep> step = stepOf(document.get(), session.get(), received);
      if (step.isEmpty()) {
         return Optional.empty();
      }
      Request example = requestRepository.findByOperationIdAndName(dispatched.getOperationId(), dispatched.getName())
            .stream().findFirst().orElse(null);
      Response answer = copyOf(dispatched);
      answer.setContent(ArazzoSessionAnswer.filled(dispatched.getContent(), ArazzoSessionAnswer
            .replacements(step.get().step(), example, ArazzoSessionVerifier.requestOf(step.get(), received))));
      return Optional.of(answer);
   }

   /** The step of the workflow of the session the call matches. */
   private Optional<ExpectedStep> stepOf(ArazzoDocument document, ArazzoSession session, ArazzoSessionCall received) {
      Map<String, ResolvedSource> sources = arazzoDocumentService.resolveSources(document);
      ArazzoWorkflow workflow = ArazzoWorkflowReader
            .workflow(ArazzoWorkflowService.parse(document.getContent()), session.getWorkflowId()).orElseThrow();
      List<ExpectedStep> steps = new ArrayList<>();
      for (ArazzoStep step : workflow.steps()) {
         ResolvedSource source = sources.get(step.call().sourceName());
         steps.add(
               new ExpectedStep(steps.size(), step,
                     ArazzoDocumentService.operationOf(new ArazzoStepCall(step.call().sourceName(),
                           step.call().operationId(), step.call().channel()), sources),
                     source.link().apiName(), source.link().apiVersion(), null));
      }
      return steps.stream().filter(step -> ArazzoSessionVerifier.calls(received, step)).findFirst();
   }

   private static Response copyOf(Response example) {
      Response copy = new Response();
      copy.setName(example.getName());
      copy.setStatus(example.getStatus());
      copy.setMediaType(example.getMediaType());
      copy.setHeaders(example.getHeaders());
      return copy;
   }
}
