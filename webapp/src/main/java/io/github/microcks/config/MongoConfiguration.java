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
package io.github.microcks.config;

import io.github.microcks.domain.ArazzoSession;
import io.github.microcks.domain.ArazzoSessionCall;
import io.github.microcks.domain.ServiceState;

import com.mongodb.WriteConcern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DataAccessException;
import org.springframework.data.mapping.context.MappingContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.WriteConcernResolver;
import org.springframework.data.mongodb.core.index.IndexDefinition;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.IndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;

/**
 * Configuration object for MongoDB backend.
 * @author laurent
 */
@Configuration
public class MongoConfiguration {

   /** A simple logger for diagnostic messages. */
   private static final Logger log = LoggerFactory.getLogger(MongoConfiguration.class);

   MongoTemplate mongoTemplate;

   /**
    * Build a MongoConfiguration with required dependencies.
    * @param mongoTemplate Template for updating Mongo indexes
    */
   MongoConfiguration(MongoTemplate mongoTemplate) {
      this.mongoTemplate = mongoTemplate;
   }

   @EventListener(ContextRefreshedEvent.class)
   public void initIndicesAfterStartup() {
      // Ensure indices in a background thread: this requires a Mongo roundtrip that doesn't
      // need to block or delay the application startup completion.
      Thread.ofVirtual().name("mongo-indices-initializer").start(() -> {
         log.info("Ensuring TTL and unique indexes for ServiceState");
         MappingContext<? extends MongoPersistentEntity<?>, MongoPersistentProperty> mappingContext = mongoTemplate
               .getConverter().getMappingContext();

         IndexResolver resolver = new MongoPersistentEntityIndexResolver(mappingContext);
         IndexOperations indexOps = mongoTemplate.indexOps(ServiceState.class);

         ensureIndexes(indexOps, resolver.resolveIndexFor(ServiceState.class));

         // The Arazzo verification sessions and their calls expire, so that their collections stay bounded.
         log.info("Ensuring TTL indexes for ArazzoSession and ArazzoSessionCall");
         IndexOperations sessionIndexOps = mongoTemplate.indexOps(ArazzoSession.class);
         resolver.resolveIndexFor(ArazzoSession.class).forEach(sessionIndexOps::createIndex);
         IndexOperations callIndexOps = mongoTemplate.indexOps(ArazzoSessionCall.class);
         resolver.resolveIndexFor(ArazzoSessionCall.class).forEach(callIndexOps::createIndex);
      });
   }

   /**
    * Ensure indexes one by one: an index the data does not allow, as the unique index of the states over two states of
    * one key written before it existed, is reported and the other indexes are still ensured.
    * @param indexOps The operations on the indexes of a collection
    * @param indexes  The indexes to ensure on it
    */
   static void ensureIndexes(IndexOperations indexOps, Iterable<? extends IndexDefinition> indexes) {
      for (IndexDefinition index : indexes) {
         try {
            indexOps.createIndex(index);
         } catch (DataAccessException dae) {
            log.warn("Index {} could not be ensured: {}", index.getIndexKeys(), dae.getMessage());
         }
      }
   }

   @Bean
   public WriteConcernResolver writeConcernResolver() {
      return action -> {
         log.info("Using Write Concern of Acknowledged");
         return WriteConcern.ACKNOWLEDGED;
      };
   }
}
