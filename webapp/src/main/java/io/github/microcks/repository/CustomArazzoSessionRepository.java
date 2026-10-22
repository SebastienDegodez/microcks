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
package io.github.microcks.repository;

import io.github.microcks.domain.ArazzoSession;

import java.util.Date;

/**
 * Custom repository interface for the verification sessions of Arazzo workflows.
 * @author SebastienDegodez
 */
public interface CustomArazzoSessionRepository {

   /**
    * Count a call an open session receives, atomically, so that calls received at once each get their own order index.
    * @param sessionId The id of a session
    * @param maxCalls  How many calls a session records at most
    * @param now       When the call is received
    * @return The session with the call counted, its count telling the order index of the call; null when the session
    *         does not exist, is closed, has expired or has recorded its maximum of calls
    */
   ArazzoSession countCall(String sessionId, long maxCalls, Date now);

   /**
    * Count a call an open session does not record, as it recorded its maximum of calls; atomically.
    * @param sessionId The id of a session
    * @param maxCalls  How many calls a session records at most
    * @param now       When the call is received
    */
   void countDroppedCall(String sessionId, long maxCalls, Date now);

   /**
    * Close a session: it records no more calls, and it and its calls expire at the given date. A session already closed
    * is left as it is.
    * @param sessionId  The id of a session
    * @param closedDate When it is closed
    * @param expireAt   When it and its calls expire
    * @return Whether the session exists
    */
   boolean close(String sessionId, Date closedDate, Date expireAt);
}
