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

import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.Date;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests of the atomic write of the state of a service, on a database that does not retry an upsert the unique index of
 * the states refused.
 * @author SebastienDegodez
 */
class ServiceStateRepositoryImplTest {

   /** The write that lost the race to create the state of a key replaces the state the winner created. */
   @Test
   void aWriteRefusedAsTheKeyGotItsStateAtTheSameInstantReplacesThatState() {
      MongoTemplate template = mock(MongoTemplate.class);
      when(template.upsert(any(Query.class), any(Update.class), eq(ServiceState.class)))
            .thenThrow(new DuplicateKeyException("E11000 duplicate key error")).thenReturn(null);

      new ServiceStateRepositoryImpl(template).upsert("a-service", "counter", "2", new Date());

      verify(template, times(2)).upsert(any(Query.class), any(Update.class), eq(ServiceState.class));
   }
}
