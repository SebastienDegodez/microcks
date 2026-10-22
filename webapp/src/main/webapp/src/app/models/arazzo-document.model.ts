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
import { ServiceType } from './service.model';
import { WorkflowRunSummary } from './arazzo-run.model';

/** How the last run of an Arazzo workflow went. */
export type ArazzoLastResult = 'NEVER_RUN' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';

export interface ArazzoSourceLink {
  sourceName: string;
  apiName: string | null;
  apiVersion: string | null;
  linked: boolean;
}

export interface ArazzoSourceSummary {
  link: ArazzoSourceLink;
  apiId: string | null;
  apiType: ServiceType | null;
}

export interface ArazzoWorkflowStatus {
  workflowId: string;
  runnable: boolean;
  reasons: string[];
}

export interface ArazzoWorkflowSummary {
  status: ArazzoWorkflowStatus;
  /** The summary of the workflow, or else its description. */
  description: string | null;
  stepCount: number;
  lastResult: ArazzoLastResult;
  /** The last run of the workflow; absent when it never ran. */
  lastRun?: WorkflowRunSummary;
}

export interface ArazzoDocumentSummary {
  id: string;
  title: string;
  version: string;
  /** Unknown for a document imported before it was kept. */
  arazzoVersion: string | null;
  fileName: string | null;
  /** When the document was last imported, in milliseconds since the epoch; unknown for a document imported before it was kept. */
  importDate: number | null;
  sources: ArazzoSourceSummary[];
  workflows: ArazzoWorkflowSummary[];
}

/** Whether the contract a source description declares names an API of Microcks. */
export type ArazzoSourceMatchStatus = 'MATCHED' | 'NO_API' | 'UNREADABLE';

export interface ArazzoSourceMatch {
  status: ArazzoSourceMatchStatus;
  /** The title of the declared contract; null when it cannot be read. */
  contractTitle: string | null;
  /** The version of the declared contract; null when it cannot be read. */
  contractVersion: string | null;
}

export interface ArazzoSourceAnalysis {
  sourceName: string;
  declaredUrl: string;
  match: ArazzoSourceMatch;
  /** The link chosen, or else the one matched. */
  link: ArazzoSourceLink;
  /** How many distinct operations the steps call on this source. */
  operationCount: number;
  /** How many of these operations the linked API defines. */
  foundOperationCount: number;
  /** How many steps call an operation of this source that is not found. */
  unresolvedStepCount: number;
}

export interface ArazzoWorkflowCheck {
  workflowId: string;
  runnable: boolean;
  /** The linked APIs its steps call. */
  apiNames: string[];
  /** The source descriptions its steps call that are not linked. */
  unlinkedSources: string[];
  /** Why a step calling a linked API is not resolved. */
  reasons: string[];
}

/** An API of Microcks a source description can be linked to. */
export interface ArazzoApiRef {
  name: string;
  version: string;
}

/** What an Arazzo document would become if it were imported with the links of its sources. */
export interface ArazzoImportAnalysis {
  /** Why the document cannot be imported; null when it can. */
  refusal: string | null;
  arazzoVersion: string | null;
  title: string | null;
  version: string | null;
  workflowIds: string[];
  sources: ArazzoSourceAnalysis[];
  checks: ArazzoWorkflowCheck[];
  apis: ArazzoApiRef[];
}

/** The API each source description is linked to, by name; null when it is not linked. */
export type ArazzoSourceLinks = Record<string, ArazzoApiRef | null>;
