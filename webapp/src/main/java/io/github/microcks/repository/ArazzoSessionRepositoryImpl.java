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

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * Implementation for CustomArazzoSessionRepository.
 * @author SebastienDegodez
 */
public class ArazzoSessionRepositoryImpl implements CustomArazzoSessionRepository {

   private final MongoTemplate template;

   public ArazzoSessionRepositoryImpl(MongoTemplate template) {
      this.template = template;
   }

   @Override
   public long nextCallIndex(String sessionId) {
      // The count is incremented in the database, so that two calls received at once get two indexes.
      ArazzoSession counted = template.findAndModify(
            new Query(Criteria.where("_id").is(sessionId).and("closedDate").isNull()), new Update().inc("callCount", 1),
            FindAndModifyOptions.options().returnNew(true), ArazzoSession.class);
      return counted == null ? -1L : counted.getCallCount() - 1;
   }
}
