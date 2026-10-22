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
  /** Relative to Microcks for its mocks, such as /rest/API+Pastry+-+2.0/2.0.0; absolute for an implementation. */
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
  /** The secret whose authorization the calls to the implementations carried. */
  secretRef?: { secretId: string; name: string };
  /** The number of the run in its document, from 1; absent for a run launched before runs were numbered. */
  number?: number;
  /** The example the mocks lack for the run to go on; absent when the run did not fail for a missing example. */
  missingExample?: WorkflowMissingExample;
  /** Whether each step response was validated against the OpenAPI schema of its operation. */
  validateSchema?: boolean;
  /** The recorded example the run played, with its verdict once the run ended; absent when it played none. */
  example?: WorkflowExampleCheck;
};

/** Whether a run matches the recorded example it played, apart from its own result. */
export type WorkflowExampleVerdict = 'MATCHES' | 'DOES_NOT_MATCH';

/** What a recorded example expects of a step: its exact status, and the outputs it lists. */
export type ArazzoStepExpectation = {
  stepId: string;
  status?: number;
  outputs: Record<string, unknown>;
};

/** The recorded example a run played: what it expects and, once the run ended, its verdict. */
export type WorkflowExampleCheck = {
  name: string;
  outputs: Record<string, unknown>;
  steps: ArazzoStepExpectation[];
  /** The step the workflow is expected to stop at; absent when it is expected to run to its end. */
  stopsAt?: string;
  /** Absent while the run is in progress. */
  verdict?: WorkflowExampleVerdict;
  unmetExpectations: string[];
};

/** How the run of a recorded example was launched by Run all examples: its run, or why it was refused. */
export type ArazzoExampleLaunch = {
  example: string;
  runId?: string;
  number?: number;
  refusal?: string;
};

/** The implementations a run calls instead of the mocks: one base URL per linked source, and an optional secret. */
export type WorkflowRunImplementations = {
  baseUrls: Record<string, string>;
  secretName?: string;
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
  /** The recorded example the run played; absent when it played none. */
  example?: string;
  /** Whether the run matches its example; absent when it played none or is in progress. */
  exampleVerdict?: WorkflowExampleVerdict;
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

/** The step of a run against the mocks that sent values for which the operation it called has no example. */
export type WorkflowMissingExample = {
  stepIndex: number;
  stepId: string;
  /** The id of the Microcks API whose mocks the step called. */
  serviceId: string;
  operationId: string;
  /** The name of the operation in Microcks, such as GET /pastry/{name}. */
  operationName: string;
  /** The parameters the mocks dispatch on, as the step sent them. */
  parameters: WorkflowParameterValue[];
};
