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
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

/**
 * Implementation for CustomWorkflowResultRepository.
 * @author SebastienDegodez
 */
public class WorkflowResultRepositoryImpl implements CustomWorkflowResultRepository {

   private final MongoTemplate template;

   public WorkflowResultRepositoryImpl(MongoTemplate template) {
      this.template = template;
   }

   @Override
   public List<WorkflowResult> findByDocumentIdAndFilter(String documentId, WorkflowRunFilter filter,
         Pageable pageable) {
      return template.find(query(documentId, filter).with(pageable), WorkflowResult.class);
   }

   @Override
   public long countByDocumentIdAndFilter(String documentId, WorkflowRunFilter filter) {
      return template.count(query(documentId, filter), WorkflowResult.class);
   }

   /** The runs of a document, each filter adding its criterion only when it is given. */
   private static Query query(String documentId, WorkflowRunFilter filter) {
      Query query = new Query(Criteria.where("documentId").is(documentId));
      if (filter.workflowId() != null) {
         query.addCriteria(Criteria.where("workflowId").is(filter.workflowId()));
      }
      if (filter.target() != null) {
         query.addCriteria(Criteria.where("target").is(filter.target()));
      }
      if (filter.result() != null) {
         query.addCriteria(Criteria.where("status").is(filter.result()));
      }
      return query;
   }
}
