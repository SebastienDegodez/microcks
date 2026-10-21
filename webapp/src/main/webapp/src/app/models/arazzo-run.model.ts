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
/** Where a run of an Arazzo workflow stands. */
export type WorkflowRunStatus = 'IN_PROGRESS' | 'SUCCESS' | 'FAILURE';

/** What the steps of a run call: the Microcks mocks, or the implementations of the APIs. */
export type WorkflowRunTarget = 'MOCKS' | 'IMPLEMENTATIONS';

/** How a step of a run ended. */
export type WorkflowStepStatus = 'PASSED' | 'FAILED' | 'NOT_RUN';

/** Where a run called the operations of a source description, and the API it is linked to. */
export type WorkflowSourceTarget = {
  sourceName: string;
  serviceId: string;
  apiName: string;
  apiVersion: string;
  /** Relative to Microcks for its mocks, such as /rest/API+Pastry+-+2.0/2.0.0. */
  baseUrl: string;
};

/** The value a runtime expression had when a criterion was evaluated. */
export type WorkflowExpressionValue = {
  expression: string;
  value?: unknown;
};

export type WorkflowCriterionResult = {
  condition: string;
  values: WorkflowExpressionValue[];
  held: boolean;
};

export type WorkflowStepOperation = {
  sourceName: string;
  operationId: string;
  method?: string;
  path?: string;
};

/** A step of a run: its index is its place in the execution order. */
export type WorkflowStepResult = {
  index: number;
  stepId: string;
  operation: WorkflowStepOperation;
  status: WorkflowStepStatus;
  statusCode?: number;
  elapsedTime: number;
  criteria: WorkflowCriterionResult[];
  outputs: Record<string, unknown>;
  testCaseId?: string;
  message?: string;
};

/** A run of a workflow, as GET /api/arazzo/runs/{runId} answers it. */
export type WorkflowResult = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentVersion: string;
  workflowId: string;
  target: WorkflowRunTarget;
  sources: WorkflowSourceTarget[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status: WorkflowRunStatus;
  startedDate: number | string;
  elapsedTime: number;
  timeout?: number;
  steps: WorkflowStepResult[];
  message?: string;
  /** The number of the run in its document, from 1; absent for a run launched before runs were numbered. */
  number?: number;
};

/** What the runs history shows of a run, as GET /api/arazzo/documents/{documentId}/runs answers it. */
export type WorkflowRunSummary = {
  id: string;
  number?: number;
  workflowId: string;
  target: WorkflowRunTarget;
  status: WorkflowRunStatus;
  /** The step the run failed at; absent when no step failed. */
  failedStepId?: string;
  startedDate: number | string;
  elapsedTime: number;
};

/** How many runs a runs history lists, and how many of them passed and failed. */
export type WorkflowRunCounts = {
  total: number;
  passed: number;
  failed: number;
};

/** The filters of a runs history; an absent filter keeps every run. */
export type WorkflowRunFilter = {
  workflow?: string;
  target?: WorkflowRunTarget;
  result?: WorkflowRunStatus;
};
