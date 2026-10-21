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
import io.github.microcks.repository.ArazzoDocumentRepository;
import io.github.microcks.repository.RepositoryTestsConfiguration;
import io.github.microcks.util.MockRepositoryImportException;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Acceptance tests of the import of an Arazzo document, one per acceptance criterion of the story.
 * @author SebastienDegodez
 */
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
@SpringJUnitConfig(classes = RepositoryTestsConfiguration.class)
@TestPropertySource(locations = { "classpath:/config/test.properties" })
class ArazzoDocumentServiceTest {

   @Autowired
   private ArazzoDocumentService service;

   @Autowired
   private ArazzoDocumentRepository repository;

   @Test
   void aSupportedDocumentIsImported() throws Exception {
      service.importArazzoDocument(fixture("pastry.arazzo.yaml"));

      ArazzoDocument imported = repository.findByTitleAndVersion("API Pastry scenarios", "1.0.0");
      assertNotNull(imported);
      assertEquals(List.of("readThenReprice", "listThenReadFirst"), imported.getWorkflowIds());
   }

   @Test
   void aDocumentThatIsNeitherYamlNorJsonIsRefused() throws Exception {
      String content = fixture("unparseable.arazzo.yaml");

      assertThrows(MockRepositoryImportException.class, () -> service.importArazzoDocument(content));
   }

   private static String fixture(String fileName) throws IOException {
      try (InputStream stream = ArazzoDocumentServiceTest.class
            .getResourceAsStream("/io/github/microcks/service/arazzo/" + fileName)) {
         return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      }
   }
}
