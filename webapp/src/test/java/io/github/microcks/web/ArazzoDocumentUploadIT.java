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

import io.github.microcks.domain.ArazzoDocument;
import io.github.microcks.repository.ArazzoDocumentRepository;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.io.File;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Integration tests of the import of Arazzo documents through the artifact upload endpoint.
 * @author SebastienDegodez
 */
class ArazzoDocumentUploadIT extends AbstractBaseIT {

   private static final String FIXTURES = "target/test-classes/io/github/microcks/service/arazzo/";

   @Autowired
   private ArazzoDocumentRepository arazzoDocumentRepository;

   @AfterEach
   void deleteDocuments() {
      arazzoDocumentRepository.deleteAll();
   }

   @Test
   void uploadingASupportedDocumentImportsIt() {
      ResponseEntity<String> response = upload("pastry.arazzo.yaml");

      assertEquals(201, response.getStatusCode().value());
      assertEquals("API Pastry scenarios:1.0.0", response.getBody());
   }

   @Test
   void uploadingAnUnsupportedDocumentIsRefusedWithItsReason() {
      ResponseEntity<String> response = upload("unsupported-version.arazzo.yaml");

      assertEquals(400, response.getStatusCode().value());
      assertEquals("Unsupported Arazzo version: 2.0.0", response.getBody());
   }

   @Test
   void uploadingANewRevisionUpdatesTheStoredDocument() {
      upload("pastry.arazzo.yaml");

      upload("pastry-revision.arazzo.yaml");

      assertEquals(List.of("API Pastry scenarios 1.0.0: [readThenReprice, listThenReadFirst, repriceAll]"),
            arazzoDocumentRepository.findAll().stream().map(ArazzoDocumentUploadIT::describe).toList());
   }

   private ResponseEntity<String> upload(String fixture) {
      HttpHeaders headers = new HttpHeaders();
      headers.setContentType(MediaType.MULTIPART_FORM_DATA);
      MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
      body.add("file", new FileSystemResource(new File(FIXTURES + fixture)));
      return restTemplate.postForEntity("/api/artifact/upload", new HttpEntity<>(body, headers), String.class);
   }

   private static String describe(ArazzoDocument document) {
      return document.getTitle() + " " + document.getVersion() + ": " + document.getWorkflowIds();
   }
}
