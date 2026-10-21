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

/** The link between a source description of an Arazzo document and the Microcks API it describes. */
export type ArazzoSourceLink = {
  sourceName: string;
  apiName?: string;
  apiVersion?: string;
  linked: boolean;
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

export type ArazzoStepDetail = {
  stepId: string;
  description?: string;
  operation: ArazzoStepOperation;
  parameters: ArazzoStepParameter[];
  requestBody?: ArazzoStepRequestBody;
  successCriteria: ArazzoStepCriterion[];
  outputs: Record<string, string>;
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
  workflowIds: string[];
  sources: ArazzoSourceLink[];
  workflowId: string;
  summary?: string;
  description?: string;
  inputs: ArazzoWorkflowInput[];
  steps: ArazzoStepDetail[];
  outputs: Record<string, string>;
  dataPassings: ArazzoDataPassing[];
};
