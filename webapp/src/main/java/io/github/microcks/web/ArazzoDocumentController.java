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
import io.github.microcks.domain.ArazzoImportAnalysis;
import io.github.microcks.service.ArazzoDocumentService;
import io.github.microcks.service.ArazzoImportService;
import io.github.microcks.util.MockRepositoryImportException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * A Rest controller for the Arazzo documents imported into Microcks.
 * @author SebastienDegodez
 */
@RestController
@RequestMapping("/api/arazzo")
public class ArazzoDocumentController {

   private final ArazzoDocumentService arazzoDocumentService;
   private final ArazzoImportService arazzoImportService;

   /**
    * Build a new ArazzoDocumentController with its dependencies.
    * @param arazzoDocumentService to summarise the imported Arazzo documents
    * @param arazzoImportService   to analyse and import the Arazzo documents dropped in the import dialog
    */
   public ArazzoDocumentController(ArazzoDocumentService arazzoDocumentService,
         ArazzoImportService arazzoImportService) {
      this.arazzoDocumentService = arazzoDocumentService;
      this.arazzoImportService = arazzoImportService;
   }

   /**
    * Analyse an Arazzo document before importing it. Nothing is stored.
    * @param request The document, with the links chosen for its source descriptions, if any
    * @return Whether the document can be imported, the API each source is linked to, and whether each workflow is ready
    *         to run
    */
   @PostMapping(value = "/documents/analysis")
   public ArazzoImportAnalysis analyseDocument(@RequestBody ArazzoImportRequest request) {
      return arazzoImportService.analyseArazzoDocument(request.content(), request.links());
   }

   /**
    * Import an Arazzo document with the links chosen for its source descriptions, all or nothing.
    * @param request The document, with the links chosen for its source descriptions
    * @return The summary of the imported document, or why it is refused
    */
   @PostMapping(value = "/documents")
   public ResponseEntity<Object> importDocument(@RequestBody ArazzoImportRequest request) {
      try {
         return new ResponseEntity<>(arazzoImportService.importArazzoDocument(request.content(), request.fileName(),
               request.links() == null ? Map.of() : request.links()), HttpStatus.CREATED);
      } catch (MockRepositoryImportException mrie) {
         return new ResponseEntity<>(mrie.getMessage(), HttpStatus.BAD_REQUEST);
      }
   }

   /**
    * Analyse the links of the source descriptions of an imported Arazzo document, to link them again. Nothing is
    * stored.
    * @param documentId The identifier of the imported document
    * @param request    The links chosen for its source descriptions; none for the links of its overlay
    * @return The API each source is linked to, and whether each workflow is ready to run; 404 for an unknown document
    * @throws MockRepositoryImportException if the stored document cannot be read anymore
    */
   @PostMapping(value = "/documents/{id}/analysis")
   public ResponseEntity<ArazzoImportAnalysis> analyseImportedDocument(@PathVariable("id") String documentId,
         @RequestBody ArazzoLinksRequest request) throws MockRepositoryImportException {
      ArazzoImportAnalysis analysis = arazzoImportService.analyseImportedDocument(documentId, request.links());
      return analysis == null ? new ResponseEntity<>(HttpStatus.NOT_FOUND)
            : new ResponseEntity<>(analysis, HttpStatus.OK);
   }

   /**
    * Link the source descriptions of an imported Arazzo document again, replacing the sources of its overlay.
    * @param documentId The identifier of the imported document
    * @param request    The links chosen for its source descriptions
    * @return The summary of the document, why the links are refused, or 404 for an unknown document
    */
   @PutMapping(value = "/documents/{id}/sources")
   public ResponseEntity<Object> relinkSources(@PathVariable("id") String documentId,
         @RequestBody ArazzoLinksRequest request) {
      try {
         ArazzoDocumentSummary summary = arazzoImportService.relinkSources(documentId,
               request.links() == null ? Map.of() : request.links());
         return summary == null ? new ResponseEntity<>(HttpStatus.NOT_FOUND)
               : new ResponseEntity<>(summary, HttpStatus.OK);
      } catch (MockRepositoryImportException mrie) {
         return new ResponseEntity<>(mrie.getMessage(), HttpStatus.BAD_REQUEST);
      }
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
