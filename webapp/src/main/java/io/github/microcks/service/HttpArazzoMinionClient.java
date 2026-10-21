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
package io.github.microcks.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Hands the runs of Arazzo workflows to the Arazzo minion over HTTP, on its POST /api/runs endpoint.
 * @author SebastienDegodez
 */
@Component
public class HttpArazzoMinionClient implements ArazzoMinionClient {

   private final String arazzoMinionUrl;
   private final RestClient restClient = RestClient.create();

   /**
    * @param arazzoMinionUrl The URL of the Arazzo minion
    */
   public HttpArazzoMinionClient(@Value("${arazzo-minion.url}") String arazzoMinionUrl) {
      this.arazzoMinionUrl = arazzoMinionUrl;
   }

   @Override
   public void launch(ArazzoRunRequest request) throws ArazzoMinionException {
      try {
         restClient.post().uri(arazzoMinionUrl + "/api/runs").contentType(MediaType.APPLICATION_JSON).body(request)
               .retrieve().toBodilessEntity();
      } catch (RestClientException rce) {
         throw new ArazzoMinionException("The Arazzo minion at " + arazzoMinionUrl + " did not receive the run", rce);
      }
   }
}
