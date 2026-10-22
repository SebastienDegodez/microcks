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
import { ArazzoWorkflowStatus } from './arazzo-document.model';
import { ArazzoStepExpectation } from './arazzo-run.model';

/** The link between a source description of an Arazzo document and the Microcks API it describes. */
export type ArazzoSourceLink = {
  sourceName: string;
  apiName?: string;
  apiVersion?: string;
  linked: boolean;
};

/** A source description with the API it is linked to, or the reason why it is not linked. */
export type ArazzoSourceDescription = {
  link: ArazzoSourceLink;
  serviceId?: string;
  reason?: string;
  operations: number;
  usedOperations: number;
};

/** The operation a step calls: method and path when found in the linked API, else the reason why it is not. */
export type ArazzoStepOperation = {
  sourceName: string;
  operationId: string;
  method?: string;
  path?: string;
  reason?: string;
};

export type ArazzoStepParameter = {
  name: string;
  in: string;
  value: string;
};

export type ArazzoStepRequestBody = {
  contentType?: string;
  payload: string;
  replacements: Record<string, string>;
};

export type ArazzoStepCriterion = {
  condition: string;
  context?: string;
  type: string;
};

/** What a step does when it succeeds or fails: retry the step, or end the workflow, when its criteria hold. */
export type ArazzoStepAction = {
  name: string;
  type: 'retry' | 'end';
  /** How long a retry waits before calling the step again, in seconds; absent for an end. */
  retryAfter?: number;
  /** How many times a retry may call the step again; absent for an end. */
  retryLimit?: number;
  criteria: ArazzoStepCriterion[];
};

export type ArazzoStepDetail = {
  stepId: string;
  description?: string;
  operation: ArazzoStepOperation;
  parameters: ArazzoStepParameter[];
  requestBody?: ArazzoStepRequestBody;
  successCriteria: ArazzoStepCriterion[];
  outputs: Record<string, string>;
  /** What the step does when it succeeds, in the order of the document. */
  onSuccess?: ArazzoStepAction[];
  /** What the step does when it fails, in the order of the document. */
  onFailure?: ArazzoStepAction[];
};

/** Where a step uses a runtime expression: place is path, query, header, body or criterion. */
export type ArazzoExpressionUse = {
  stepId: string;
  place: string;
  target?: string;
};

export type ArazzoWorkflowInput = {
  name: string;
  usedBy: ArazzoExpressionUse[];
  /** The JSON schema type the workflow declares for the input, such as number. */
  type?: string;
  /** Whether a run needs the input: the steps or outputs use it, or the inputs schema requires it. */
  required?: boolean;
};

/** An output of a step that a later step uses. */
export type ArazzoDataPassing = {
  fromStepId: string;
  outputName: string;
  to: ArazzoExpressionUse;
};

export type ArazzoWorkflowDetail = {
  documentId: string;
  title: string;
  version: string;
  arazzoVersion: string;
  fileName?: string;
  importDate: string | number;
  workflowIds: string[];
  sources: ArazzoSourceDescription[];
  workflowId: string;
  summary?: string;
  description?: string;
  inputs: ArazzoWorkflowInput[];
  steps: ArazzoStepDetail[];
  outputs: Record<string, string>;
  dataPassings: ArazzoDataPassing[];
  /** Whether the workflow can run, else why. */
  status: ArazzoWorkflowStatus;
  /** The recorded examples of the workflow, from its ArazzoSources overlay. */
  examples?: ArazzoWorkflowExample[];
};

/** A recorded example of a workflow: the inputs to run it with, and what the run is expected to show. */
export type ArazzoWorkflowExample = {
  workflowId: string;
  name: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  steps: ArazzoStepExpectation[];
  /** The step the workflow is expected to stop at; absent when it is expected to run to its end. */
  stopsAt?: string;
};
