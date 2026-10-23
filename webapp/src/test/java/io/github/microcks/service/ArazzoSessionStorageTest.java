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
import io.github.microcks.domain.WorkflowResult;
import io.github.microcks.domain.WorkflowRunStatus;
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.ArazzoSessionCallRepository;
import io.github.microcks.repository.ArazzoSessionRepository;
import io.github.microcks.repository.RepositoryTestsConfiguration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Tests of how long the sessions and their calls are kept, and how many calls a session records: an open session
 * expires after its maximum duration, a closed one after the retention delay, with its calls; a session records its
 * calls up to its maximum.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = { RepositoryTestsConfiguration.class })
@TestPropertySource(locations = { "classpath:/config/test.properties" }, properties = {
      "arazzo.sessions.max-open-duration=120", "arazzo.sessions.retention=60", "arazzo.sessions.max-calls=2" })
class ArazzoSessionStorageTest {

   @Autowired
   private ArazzoSessionService arazzoSessionService;

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @Autowired
   private ArazzoSessionRepository arazzoSessionRepository;

   @Autowired
   private ArazzoSessionCallRepository arazzoSessionCallRepository;

   private ArazzoDocument saga;

   @BeforeEach
   void anArazzoDocumentIsImported() {
      saga = new ArazzoDocument();
      saga.setTitle("Order saga");
      saga.setVersion("1.0.0");
      saga.setWorkflowIds(List.of("placeOrderSaga"));
      saga.setSourceNames(List.of());
      saga.setWorkflowCalls(Map.of("placeOrderSaga", List.of()));
      saga.setContent("""
            arazzo: 1.0.1
            info:
              title: Order saga
              version: 1.0.0
            sourceDescriptions: []
            workflows:
              - workflowId: placeOrderSaga
                steps: []
            """);
      saga = arazzoDocumentRepository.save(saga);
   }

   @Test
   void anOpenSessionAndItsCallsExpireAfterTheMaximumDuration() throws Exception {
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), "placeOrderSaga").orElseThrow();

      Date before = new Date();
      arazzoSessionService.recordCall(session.getId(), new ArazzoSessionCall());
      Date after = new Date();

      Date received = arazzoSessionCallRepository.findBySessionIdOrderByIndexAsc(session.getId()).get(0)
            .getReceivedDate();
      assertTrue(!received.before(before) && !received.after(after), () -> received + " is not when it was received");
      ArazzoSession stored = arazzoSessionRepository.findById(session.getId()).orElseThrow();
      assertNull(stored.getClosedDate());
      assertEquals(120_000L, stored.getExpireAt().getTime() - stored.getOpenedDate().getTime());
      assertEquals(List.of(stored.getExpireAt()), expiriesOfTheCallsOf(session));
   }

   @Test
   void aClosedSessionAndItsCallsExpireAfterTheRetentionDelay() throws Exception {
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), "placeOrderSaga").orElseThrow();
      arazzoSessionService.recordCall(session.getId(), new ArazzoSessionCall());
      arazzoSessionService.recordCall(session.getId(), new ArazzoSessionCall());

      arazzoSessionService.closeSession(session.getId());

      ArazzoSession closed = arazzoSessionRepository.findById(session.getId()).orElseThrow();
      assertNotNull(closed.getClosedDate());
      assertEquals(60_000L, closed.getExpireAt().getTime() - closed.getClosedDate().getTime());
      assertEquals(List.of(closed.getExpireAt(), closed.getExpireAt()), expiriesOfTheCallsOf(session));
   }

   @Test
   void closingASessionAgainKeepsWhenItWasClosed() throws Exception {
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), "placeOrderSaga").orElseThrow();
      arazzoSessionService.closeSession(session.getId());
      Date closedDate = arazzoSessionRepository.findById(session.getId()).orElseThrow().getClosedDate();

      assertTrue(arazzoSessionService.closeSession(session.getId()));

      assertEquals(closedDate, arazzoSessionRepository.findById(session.getId()).orElseThrow().getClosedDate());
   }

   @Test
   void aSessionRecordsItsCallsUpToItsMaximum() throws Exception {
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), "placeOrderSaga").orElseThrow();

      for (int call = 0; call < 3; call++) {
         arazzoSessionService.recordCall(session.getId(), new ArazzoSessionCall());
      }

      assertEquals(List.of(0L, 1L), arazzoSessionCallRepository.findBySessionIdOrderByIndexAsc(session.getId()).stream()
            .map(ArazzoSessionCall::getIndex).toList());
   }

   /** A session that reached its maximum of calls fails its verification, telling how many calls it did not record. */
   @ParameterizedTest
   @CsvSource(delimiter = '|', nullValues = "null", value = { "2 | 0 | SUCCESS | null",
         "3 | 1 | FAILURE | session reached 2 calls, 1 call was not recorded",
         "5 | 3 | FAILURE | session reached 2 calls, 3 calls were not recorded" })
   void aSessionThatReachedItsMaximumFailsItsVerification(int calls, long dropped, WorkflowRunStatus status,
         String message) throws Exception {
      ArazzoSession session = arazzoSessionService.openSession(saga.getId(), "placeOrderSaga").orElseThrow();

      for (int call = 0; call < calls; call++) {
         arazzoSessionService.recordCall(session.getId(), new ArazzoSessionCall());
      }

      assertEquals(dropped, arazzoSessionRepository.findById(session.getId()).orElseThrow().getDroppedCallCount());
      WorkflowResult verification = arazzoSessionService.verify(session.getId()).orElseThrow();
      assertEquals(status + " " + message, verification.getStatus() + " " + verification.getMessage());
   }

   private List<Date> expiriesOfTheCallsOf(ArazzoSession session) {
      return arazzoSessionCallRepository.findBySessionIdOrderByIndexAsc(session.getId()).stream()
            .map(ArazzoSessionCall::getExpireAt).toList();
   }
}
