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

/** How the last run of an Arazzo workflow went. Workflows do not run yet. */
export type ArazzoLastResult = 'NEVER_RUN';

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
