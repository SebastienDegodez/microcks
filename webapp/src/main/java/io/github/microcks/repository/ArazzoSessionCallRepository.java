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

import io.github.microcks.domain.ArazzoSessionCall;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/**
 * Repository interface for the calls the mocks received in the verification sessions of Arazzo workflows, kept in their
 * own collection.
 * @author SebastienDegodez
 */
public interface ArazzoSessionCallRepository extends MongoRepository<ArazzoSessionCall, String> {

   /**
    * @param sessionId The id of a session
    * @return The calls the session received, in their order of receipt
    */
   List<ArazzoSessionCall> findBySessionIdOrderByIndexAsc(String sessionId);
}
