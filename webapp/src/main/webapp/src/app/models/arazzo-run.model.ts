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
  /** The URL the step sent its request to; absent when it sent none. */
  requestUrl?: string;
  /** The parameters the step sent, with the runtime expression each value came from. */
  parameters?: WorkflowParameterValue[];
  /** The runtime expression each output came from, by output name. */
  outputOrigins?: Record<string, string>;
};

/** A parameter a step sent, with its value and the runtime expression it came from, absent for a constant. */
export type WorkflowParameterValue = {
  name: string;
  in: string;
  value?: unknown;
  expression?: string;
};

/** A run of a workflow, as GET /api/arazzo/runs/{runId} answers it. */
export type WorkflowResult = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentVersion: string;
  workflowId: string;
  target: 'MOCKS';
  sources: WorkflowSourceTarget[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status: WorkflowRunStatus;
  startedDate: number | string;
  elapsedTime: number;
  timeout?: number;
  steps: WorkflowStepResult[];
  message?: string;
};
