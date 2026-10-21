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
package io.github.microcks.web;

import io.github.microcks.domain.ArazzoDocumentSummary;
import io.github.microcks.service.ArazzoDocumentService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * A Rest controller for the Arazzo documents imported into Microcks.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoDocumentController {

   private final ArazzoDocumentService arazzoDocumentService;

   /**
    * Build a new ArazzoDocumentController with its dependencies.
    * @param arazzoDocumentService to summarise the imported Arazzo documents
    */
   public ArazzoDocumentController(ArazzoDocumentService arazzoDocumentService) {
      this.arazzoDocumentService = arazzoDocumentService;
   }

   /**
    * List the imported Arazzo documents, with the APIs their source descriptions are linked to and their workflows.
    * @param api The name of an API to list only the documents using it; every document when absent
    * @return The summary of each listed document, by title then version
    */
   @GetMapping(value = "/documents")
   public List<ArazzoDocumentSummary> listDocuments(@RequestParam(value = "api", required = false) String api) {
      return arazzoDocumentService.getDocumentSummaries(api);
   }
}
