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
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';

import { PaginationConfig, PaginationEvent, PaginationModule } from '../../../components/patternfly-ng/pagination';
import { TimeAgoPipe } from '../../../components/time-ago.pipe';
import { ArazzoDocumentSummary } from '../../../models/arazzo-document.model';
import {
  WorkflowRunCounts,
  WorkflowRunFilter,
  WorkflowRunSummary,
  WorkflowRunTarget
} from '../../../models/arazzo-run.model';
import { ArazzoDocumentsService } from '../../../services/arazzo-documents.service';
import { ArazzoRunHistoryService } from '../../../services/arazzo-run-history.service';

/** How many runs a page of the history lists. */
export const RUNS_PAGE_SIZE = 20;

/** What a target is called in the history. */
export const TARGET_LABELS: Record<WorkflowRunTarget, string> = {
  MOCKS: 'Microcks mocks',
  IMPLEMENTATIONS: 'Implementation'
};

/** Screen 7 of the mock-up: the runs of the workflows of an Arazzo document, newest first, filtered from the URL. */
@Component({
  selector: 'app-workflow-runs-page',
  templateUrl: './workflow-runs.page.html',
  styleUrls: ['./workflow-runs.page.css'],
  imports: [CommonModule, FormsModule, PaginationModule, RouterLink, TimeAgoPipe]
})
export class WorkflowRunsPageComponent implements OnInit {

  readonly targetLabels = TARGET_LABELS;

  documentId!: string;
  /** The document, once read; null when it does not exist. */
  document?: ArazzoDocumentSummary | null;
  filter: WorkflowRunFilter = {};
  runs?: WorkflowRunSummary[];
  counts?: WorkflowRunCounts;
  paginationConfig: PaginationConfig = { pageNumber: 1, pageSize: RUNS_PAGE_SIZE, pageSizeIncrements: [],
    totalItems: 0 } as PaginationConfig;

  constructor(private historySvc: ArazzoRunHistoryService, private documentsSvc: ArazzoDocumentsService,
              private route: ActivatedRoute, private router: Router) {
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      if (this.documentId !== params.get('documentId')) {
        this.documentId = params.get('documentId')!;
        this.documentsSvc.getDocuments().subscribe(documents =>
          this.document = documents.find(document => document.id === this.documentId) ?? null);
      }
      const filter: WorkflowRunFilter = {};
      (['workflow', 'target', 'result'] as const).filter(name => query.get(name))
        .forEach(name => (filter as Record<string, string>)[name] = query.get(name)!);
      this.filter = filter;
      this.historySvc.countRuns(this.documentId, this.filter).subscribe(counts => {
        this.counts = counts;
        this.paginationConfig = { ...this.paginationConfig, pageNumber: 1, totalItems: counts.total };
      });
      this.listRuns(1);
    });
  }

  /** Each filter is kept in the URL, so that a filtered history can be shared and the recent runs link to it. */
  applyFilter(name: keyof WorkflowRunFilter, value: string): void {
    this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge',
      queryParams: { [name]: value || null } });
  }

  handlePageNumber(event: PaginationEvent): void {
    this.listRuns(event.pageNumber ?? 1);
  }

  private listRuns(page: number): void {
    this.historySvc.getRuns(this.documentId, this.filter, page, RUNS_PAGE_SIZE).subscribe(runs => this.runs = runs);
  }

  get filtered(): boolean {
    return Object.values(this.filter).some(value => value);
  }

  /** The detail page of the document opens on its first workflow. */
  get documentLink(): string[] | null {
    return this.document?.workflows.length ? ['/workflows', this.document.id, this.document.workflows[0].status.workflowId]
      : null;
  }

  /** When the run started, for the time-ago pipe. */
  startedOn(run: WorkflowRunSummary): string {
    return new Date(run.startedDate).toISOString();
  }
}
