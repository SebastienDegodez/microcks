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
import { of } from 'rxjs';

import { WorkflowRunCounts, WorkflowRunFilter, WorkflowRunSummary } from '../app/models/arazzo-run.model';

export const HOUR = 3600 * 1000;

/**
 * The runs of API Pastry scenarios (document pastry-doc), newest first: #3 failed listThenReadFirst on the mocks,
 * #2 failed readThenReprice on the implementations and #1 passed readThenReprice on the mocks.
 */
export function pastryRuns(): WorkflowRunSummary[] {
  return [
    { id: 'run-3', number: 3, workflowId: 'listThenReadFirst', target: 'MOCKS', status: 'FAILURE',
      failedStepId: 'readFirst', startedDate: Date.now() - 3 * HOUR, elapsedTime: 15 },
    { id: 'run-2', number: 2, workflowId: 'readThenReprice', target: 'IMPLEMENTATIONS', status: 'FAILURE',
      failedStepId: 'reprice', startedDate: Date.now() - 5 * HOUR, elapsedTime: 58 },
    { id: 'run-1', number: 1, workflowId: 'readThenReprice', target: 'MOCKS', status: 'SUCCESS',
      startedDate: Date.now() - 48 * HOUR, elapsedTime: 24 }
  ];
}

/** Answers like the runs history endpoints: the runs matching the filters, newest first, page by page, and their counts. */
export class FakeRunHistory {
  readonly asked: { documentId: string; filter: WorkflowRunFilter; page: number; size: number }[] = [];

  constructor(private runs: WorkflowRunSummary[], private documentId = 'pastry-doc') { }

  getRuns(documentId: string, filter: WorkflowRunFilter, page = 1, size = 20) {
    this.asked.push({ documentId, filter, page, size });
    return of(this.matching(documentId, filter).slice((page - 1) * size, page * size));
  }

  countRuns(documentId: string, filter: WorkflowRunFilter) {
    const runs = this.matching(documentId, filter);
    return of({ total: runs.length, passed: runs.filter(run => run.status === 'SUCCESS').length,
      failed: runs.filter(run => run.status === 'FAILURE').length } as WorkflowRunCounts);
  }

  private matching(documentId: string, filter: WorkflowRunFilter): WorkflowRunSummary[] {
    return documentId !== this.documentId ? [] : this.runs.filter(run =>
      (!filter.workflow || run.workflowId === filter.workflow) && (!filter.target || run.target === filter.target)
      && (!filter.result || run.status === filter.result));
  }
}
