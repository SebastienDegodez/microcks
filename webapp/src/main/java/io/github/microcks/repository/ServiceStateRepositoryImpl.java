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

import io.github.microcks.domain.ServiceState;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Date;

/**
 * Implementation of the custom operations on the states of the services.
 * @author SebastienDegodez
 */
public class ServiceStateRepositoryImpl implements CustomServiceStateRepository {

   private final MongoTemplate template;

   /**
    * Build a ServiceStateRepositoryImpl.
    * @param template The template to write the states with
    */
   public ServiceStateRepositoryImpl(MongoTemplate template) {
      this.template = template;
   }

   @Override
   public void upsert(String serviceId, String key, String value, Date expireAt) {
      Query state = new Query(Criteria.where("serviceId").is(serviceId).and("key").is(key));
      Update write = new Update().set("value", value).set("expireAt", expireAt);
      try {
         template.upsert(state, write, ServiceState.class);
      } catch (DuplicateKeyException createdAtTheSameInstant) {
         // The unique index refused a second state for the key, created by a write at the same instant: the key now
         // has its state, which this write replaces. MongoDB retries such an upsert itself; not every compatible
         // database does.
         template.upsert(state, write, ServiceState.class);
      }
   }
}
