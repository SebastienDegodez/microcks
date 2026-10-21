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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.domain.ArazzoDocumentSummary;
import io.github.microcks.domain.ArazzoImportAnalysis;
import io.github.microcks.domain.ArazzoSourceAnalysis;
import io.github.microcks.domain.ArazzoSourceMatch;
import io.github.microcks.domain.ArazzoStepCall;
import io.github.microcks.domain.ArazzoWorkflowCheck;
import io.github.microcks.domain.ServiceRef;
import io.github.microcks.repository.ServiceRepository;
import io.github.microcks.service.ArazzoDocumentService.ResolvedSource;
import io.github.microcks.util.MockRepositoryImportException;
import io.github.microcks.util.arazzo.ArazzoDocumentReader;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.data.domain.Sort;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service bean behind the import dialog of Arazzo documents: it analyses a document and the links of its source
 * descriptions before the import, then imports both at once.
 * @author SebastienDegodez
 */
@org.springframework.stereotype.Service
public class ArazzoImportService {

   private static final String NOT_AN_ARAZZO_DOCUMENT = "Not an Arazzo document: it declares no arazzo version";

   private final ArazzoDocumentService arazzoDocumentService;
   private final ArazzoSourceMatcher arazzoSourceMatcher;
   private final ServiceRepository serviceRepository;

   /**
    * Build a new ArazzoImportService with its required dependencies.
    * @param arazzoDocumentService The service that imports Arazzo documents and resolves their source descriptions
    * @param arazzoSourceMatcher   The matcher of a source description to the API of its declared contract
    * @param serviceRepository     The repository of the APIs a source can be linked to
    */
   public ArazzoImportService(ArazzoDocumentService arazzoDocumentService, ArazzoSourceMatcher arazzoSourceMatcher,
         ServiceRepository serviceRepository) {
      this.arazzoDocumentService = arazzoDocumentService;
      this.arazzoSourceMatcher = arazzoSourceMatcher;
      this.serviceRepository = serviceRepository;
   }

   /**
    * Analyse an Arazzo document before importing it: whether it can be imported, the API each source description is
    * matched to, and whether each workflow is ready to run with the links of its sources. Nothing is stored.
    * @param content The document as dropped, in YAML or JSON
    * @param links   The API the developer linked each source description to, by name, a source absent or mapped to null
    *                being not linked; null to link each source to the API it is matched to
    * @return The analysis of the document
    */
   public ArazzoImportAnalysis analyseArazzoDocument(String content, Map<String, ServiceRef> links) {
      List<ServiceRef> apis = serviceRepository.findAll(Sort.by("name", "version")).stream()
            .map(api -> new ServiceRef(api.getId(), api.getName(), api.getVersion())).toList();
      Candidate candidate;
      try {
         candidate = read(content);
      } catch (MockRepositoryImportException mrie) {
         return ArazzoImportAnalysis.refused(mrie.getMessage(), apis);
      }
      ArazzoDocument document = candidate.document();
      Map<String, ArazzoSourceMatch> matches = new LinkedHashMap<>();
      candidate.declaredUrls().forEach((sourceName, url) -> matches.put(sourceName, arazzoSourceMatcher.match(url)));
      Map<String, ResolvedSource> sources = arazzoDocumentService.resolveSources(document.getSourceNames(),
            links == null ? matchedLinks(matches) : links);
      List<ArazzoStepCall> calls = document.getWorkflowIds().stream()
            .flatMap(workflowId -> document.getWorkflowCalls().get(workflowId).stream()).toList();
      List<ArazzoSourceAnalysis> sourceAnalyses = document.getSourceNames().stream()
            .map(sourceName -> analyse(sources.get(sourceName), candidate.declaredUrls().get(sourceName),
                  matches.get(sourceName), calls, sources))
            .toList();
      List<ArazzoWorkflowCheck> checks = document.getWorkflowIds().stream()
            .map(workflowId -> check(workflowId, document.getWorkflowCalls().get(workflowId), sources)).toList();
      return new ArazzoImportAnalysis(null, document.getArazzoVersion(), document.getTitle(), document.getVersion(),
            document.getWorkflowIds(), sourceAnalyses, checks, apis);
   }

   /**
    * Import an Arazzo document with the links of its source descriptions, stored as its ArazzoSources overlay that
    * replaces an existing one. Both are imported, or none.
    * @param content  The document as dropped, in YAML or JSON
    * @param fileName The name of the file the document was dropped from; null when it is not known
    * @param links    The API the developer linked each source description to, by name, a source absent or mapped to
    *                 null being not linked
    * @return The summary of the imported document
    * @throws MockRepositoryImportException if the document or one of its links is refused: nothing is stored then
    */
   public ArazzoDocumentSummary importArazzoDocument(String content, String fileName, Map<String, ServiceRef> links)
         throws MockRepositoryImportException {
      ArazzoDocument document = read(content).document();
      Map<String, ServiceRef> linkedSources = new HashMap<>();
      for (Map.Entry<String, ServiceRef> link : links.entrySet()) {
         if (!document.getSourceNames().contains(link.getKey())) {
            throw new MockRepositoryImportException("Unknown source description: " + link.getKey());
         }
         if (link.getValue() != null) {
            linkedSources.put(link.getKey(), link.getValue());
         }
      }
      ArazzoDocument imported = arazzoDocumentService.save(document, fileName);
      arazzoDocumentService.saveSources(imported.getTitle(), imported.getVersion(), linkedSources);
      return arazzoDocumentService.summary(imported);
   }

   /** A document read without being stored, with the url each of its source descriptions declares. */
   private record Candidate(ArazzoDocument document, Map<String, String> declaredUrls) {
   }

   private static Candidate read(String content) throws MockRepositoryImportException {
      JsonNode parsed = ArazzoDocumentService.parse(content);
      if (!ArazzoDocumentReader.isArazzoDocument(parsed)) {
         throw new MockRepositoryImportException(NOT_AN_ARAZZO_DOCUMENT);
      }
      return new Candidate(ArazzoDocumentService.document(parsed, content),
            ArazzoDocumentReader.sourceDescriptionUrls(parsed));
   }

   /** Each source matched to a Microcks API is linked to it. */
   private static Map<String, ServiceRef> matchedLinks(Map<String, ArazzoSourceMatch> matches) {
      Map<String, ServiceRef> links = new HashMap<>();
      matches.forEach((sourceName, match) -> {
         if (match.status() == ArazzoSourceMatch.Status.MATCHED) {
            links.put(sourceName, new ServiceRef(null, match.contractTitle(), match.contractVersion()));
         }
      });
      return links;
   }

   /**
    * The distinct operations the steps call on a source, how many of them the linked API defines, and how many steps
    * call an operation of this source that is not found.
    */
   private static ArazzoSourceAnalysis analyse(ResolvedSource source, String declaredUrl, ArazzoSourceMatch match,
         List<ArazzoStepCall> calls, Map<String, ResolvedSource> sources) {
      String sourceName = source.link().sourceName();
      Set<String> operations = new LinkedHashSet<>();
      Set<String> foundOperations = new LinkedHashSet<>();
      int unresolvedSteps = 0;
      for (ArazzoStepCall call : calls) {
         if (call.sourceName().equals(sourceName)) {
            operations.add(call.operationId());
            if (ArazzoDocumentService.operationOf(call, sources).reason() == null) {
               foundOperations.add(call.operationId());
            } else {
               unresolvedSteps++;
            }
         }
      }
      return new ArazzoSourceAnalysis(sourceName, declaredUrl, match, source.link(), operations.size(),
            foundOperations.size(), unresolvedSteps);
   }

   /**
    * A workflow is ready to run when each of its steps calls an operation found in a linked API; else it waits for the
    * sources its steps call to be linked, or for the operations not found in the linked APIs.
    */
   private static ArazzoWorkflowCheck check(String workflowId, List<ArazzoStepCall> calls,
         Map<String, ResolvedSource> sources) {
      Set<String> apiNames = new LinkedHashSet<>();
      Set<String> unlinkedSources = new LinkedHashSet<>();
      Set<String> reasons = new LinkedHashSet<>();
      for (ArazzoStepCall call : calls) {
         ResolvedSource source = sources.get(call.sourceName());
         if (ArazzoDocumentService.unlinkedReason(source.link()) != null) {
            unlinkedSources.add(call.sourceName());
         } else {
            apiNames.add(source.link().apiName());
            String reason = ArazzoDocumentService.operationOf(call, sources).reason();
            if (reason != null) {
               reasons.add(reason);
            }
         }
      }
      return new ArazzoWorkflowCheck(workflowId, unlinkedSources.isEmpty() && reasons.isEmpty(), List.copyOf(apiNames),
            List.copyOf(unlinkedSources), List.copyOf(reasons));
   }
}
