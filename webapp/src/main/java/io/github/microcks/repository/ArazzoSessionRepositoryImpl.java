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
import io.github.microcks.domain.ArazzoSessionCall;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Date;

/**
 * Implementation for CustomArazzoSessionRepository.
 * @author SebastienDegodez
 */
public class ArazzoSessionRepositoryImpl implements CustomArazzoSessionRepository {

   private static final String ID = "_id";
   private static final String CLOSED_DATE = "closedDate";
   private static final String EXPIRE_AT = "expireAt";

   private final MongoTemplate template;

   public ArazzoSessionRepositoryImpl(MongoTemplate template) {
      this.template = template;
   }

   @Override
   public ArazzoSession countCall(String sessionId, long maxCalls, Date now) {
      // The count is incremented in the database, so that two calls received at once get two indexes.
      return template.findAndModify(
            new Query(Criteria.where(ID).is(sessionId).and(CLOSED_DATE).isNull().and(EXPIRE_AT).gt(now).and("callCount")
                  .lt(maxCalls)),
            new Update().inc("callCount", 1), FindAndModifyOptions.options().returnNew(true), ArazzoSession.class);
   }

   @Override
   public boolean close(String sessionId, Date closedDate, Date expireAt) {
      ArazzoSession closed = template.findAndModify(
            new Query(Criteria.where(ID).is(sessionId).and(CLOSED_DATE).isNull()),
            new Update().set(CLOSED_DATE, closedDate).set(EXPIRE_AT, expireAt), ArazzoSession.class);
      if (closed == null) {
         return template.exists(new Query(Criteria.where(ID).is(sessionId)), ArazzoSession.class);
      }
      template.updateMulti(new Query(Criteria.where("sessionId").is(sessionId)), new Update().set(EXPIRE_AT, expireAt),
            ArazzoSessionCall.class);
      return true;
   }
}
