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

import java.util.Date;

/**
 * Custom operations on the states of the services.
 * @author SebastienDegodez
 */
public interface CustomServiceStateRepository {

   /**
    * Keep a value under a key of the state of a service, atomically: the state is created when the key has none, else
    * its value and expiry are replaced. Two writes of one key at the same instant keep one state, with the last value.
    * @param serviceId The id of the service the state belongs to
    * @param key       The key of the value
    * @param value     The value
    * @param expireAt  When the state expires
    */
   void upsert(String serviceId, String key, String value, Date expireAt);
}
