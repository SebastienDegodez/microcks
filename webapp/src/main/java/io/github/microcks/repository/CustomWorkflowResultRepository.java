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

import io.github.microcks.domain.WorkflowResult;

import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Custom repository interface for the runs history of Arazzo workflows.
 * @author SebastienDegodez
 */
public interface CustomWorkflowResultRepository {

   /**
    * @param documentId The id of an Arazzo document
    * @param filter     The filters the runs match
    * @param pageable   The page of runs to find, with their order
    * @return The runs of the workflows of that document matching the filters, in that page
    */
   List<WorkflowResult> findByDocumentIdAndFilter(String documentId, WorkflowRunFilter filter, Pageable pageable);

   /**
    * @param documentId The id of an Arazzo document
    * @param filter     The filters the runs match
    * @return How many runs of the workflows of that document match the filters
    */
   long countByDocumentIdAndFilter(String documentId, WorkflowRunFilter filter);
}
