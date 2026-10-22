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

/**
 * Custom repository interface for the verification sessions of Arazzo workflows.
 * @author SebastienDegodez
 */
public interface CustomArazzoSessionRepository {

   /**
    * Give the next call an open session receives its order index, atomically, so that concurrent calls each get their
    * own.
    * @param sessionId The id of a session
    * @return The order index of the call, from 0; -1 when the session does not exist or is closed
    */
   long nextCallIndex(String sessionId);
}
