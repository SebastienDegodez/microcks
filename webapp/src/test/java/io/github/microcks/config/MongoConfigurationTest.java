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

import io.github.microcks.domain.ServiceState;
import io.github.microcks.repository.RepositoryTestsConfiguration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests of the indexes the Mongo configuration ensures at startup.
 * @author SebastienDegodez
 */
@SpringJUnitConfig(classes = RepositoryTestsConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class MongoConfigurationTest {

   @Autowired
   private MongoTemplate mongoTemplate;

   /** At startup, the states of the services get the unique index that keeps one state per key of a service. */
   @Test
   void theStatesGetAUniqueIndexOnTheKeyOfAServiceAtStartup() throws InterruptedException {
      new MongoConfiguration(mongoTemplate).initIndicesAfterStartup();

      assertTrue(uniqueIndexOfTheStates(), () -> mongoTemplate.indexOps(ServiceState.class).getIndexInfo().toString());
   }

   /**
    * The unique index of the states cannot be built over two states of one key written before it existed: the TTL index
    * is still ensured.
    */
   @Test
   void anIndexTheDataDoesNotAllowLeavesTheOtherIndexesEnsured() {
      IndexOperations indexOps = mock(IndexOperations.class);
      Index unique = new Index().on("serviceId", Sort.Direction.ASC).on("key", Sort.Direction.ASC).unique();
      Index ttl = new Index().on("expireAt", Sort.Direction.ASC).expire(0);
      when(indexOps.createIndex(unique)).thenThrow(new DuplicateKeyException("E11000 duplicate key error"));

      MongoConfiguration.ensureIndexes(indexOps, List.of(unique, ttl));

      verify(indexOps).createIndex(ttl);
   }

   /** Whether the unique index of the states exists; it is ensured in the background. */
   private boolean uniqueIndexOfTheStates() throws InterruptedException {
      for (int attempt = 0; attempt < 50; attempt++) {
         boolean ensured = mongoTemplate.indexOps(ServiceState.class).getIndexInfo().stream()
               .anyMatch(index -> index.isUnique() && index.isIndexForFields(List.of("serviceId", "key")));
         if (ensured) {
            return true;
         }
         Thread.sleep(100);
      }
      return false;
   }
}
