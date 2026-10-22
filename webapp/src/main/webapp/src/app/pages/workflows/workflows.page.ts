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
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { BsModalService } from 'ngx-bootstrap/modal';

import {
  ArazzoDocumentSummary,
  ArazzoLastResult,
  ArazzoSourceSummary,
  ArazzoWorkflowSummary
} from '../../models/arazzo-document.model';
import { WorkflowRunSummary } from '../../models/arazzo-run.model';
import { ServiceType } from '../../models/service.model';
import { TimeAgoPipe } from '../../components/time-ago.pipe';
import { ArazzoDocumentsService } from '../../services/arazzo-documents.service';
import { UploaderDialogService } from '../../services/uploader-dialog.service';
import { ImportArazzoDialogComponent } from './import-arazzo-dialog/import-arazzo-dialog.component';
import { openRunDialog } from './workflow-run-dialog/workflow-run.dialog';

/** The protocol chip of each type of API, in the colors of its protocol. */
const API_CHIPS: Record<ServiceType, { text: string; styleClass: string }> = {
  [ServiceType.REST]: { text: 'REST', styleClass: 'workflows-api-rest' },
  [ServiceType.SOAP_HTTP]: { text: 'SOAP', styleClass: 'workflows-api-soap' },
  [ServiceType.EVENT]: { text: 'EVENT', styleClass: 'workflows-api-event' },
  [ServiceType.GRPC]: { text: 'GRPC', styleClass: 'workflows-api-grpc' },
  [ServiceType.GRAPHQL]: { text: 'GRAPH', styleClass: 'workflows-api-graph' },
  [ServiceType.GENERIC_REST]: { text: 'DIRECT', styleClass: 'workflows-api-generic' },
  [ServiceType.GENERIC_EVENT]: { text: 'DIRECT', styleClass: 'workflows-api-generic' },
};

@Component({
  selector: 'app-workflows-page',
  templateUrl: './workflows.page.html',
  styleUrls: ['./workflows.page.css'],
  imports: [CommonModule, FormsModule, RouterLink, TimeAgoPipe],
})
export class WorkflowsPageComponent implements OnInit, OnDestroy {
  /** Every imported document, whatever the filters: tells whether the page is empty and which APIs to filter on. */
  allDocuments?: ArazzoDocumentSummary[];
  /** The documents using the API filtered on. */
  apiDocuments: ArazzoDocumentSummary[] = [];
  apiNames: string[] = [];
  apiFilter = '';
  nameFilter = '';
  /** The last result of the workflows listed; empty to list every workflow. */
  resultFilter: ArazzoLastResult | '' = '';
  /** The documents whose workflows are shown: the first one when the page opens. */
  expandedDocumentIds = new Set<string>();

  constructor(
    private arazzoDocumentsSvc: ArazzoDocumentsService,
    private uploaderDialogService: UploaderDialogService,
    private modalService: BsModalService
  ) {}

  ngOnInit(): void {
    this.uploaderDialogService.registerPageRefreshCallback('/workflows', () => this.getDocuments());
    this.getDocuments();
  }

  ngOnDestroy(): void {
    this.uploaderDialogService.unregisterPageRefreshCallback('/workflows');
  }

  getDocuments(): void {
    this.arazzoDocumentsSvc.getDocuments().subscribe((documents) => {
      this.allDocuments = documents;
      if (this.expandedDocumentIds.size === 0 && documents.length > 0) {
        this.expandedDocumentIds.add(documents[0].id);
      }
      this.apiNames = Array.from(
        new Set(documents.flatMap((document) => document.sources.map((source) => source.link.apiName)))
      )
        .filter((apiName): apiName is string => apiName != null)
        .sort();
      this.filterByApi();
    });
  }

  filterByApi(): void {
    if (!this.apiFilter) {
      this.apiDocuments = this.allDocuments ?? [];
      return;
    }
    this.arazzoDocumentsSvc.getDocuments(this.apiFilter).subscribe((documents) => (this.apiDocuments = documents));
  }

  /**
   * The documents using the API filtered on, whose title or one of the workflow ids contains the name filtered on,
   * and with a workflow whose last result is the one filtered on.
   */
  get documents(): ArazzoDocumentSummary[] {
    const name = this.nameFilter.trim().toLowerCase();
    return this.apiDocuments.filter(
      (document) =>
        (!name ||
          document.title.toLowerCase().includes(name) ||
          document.workflows.some((workflow) => workflow.status.workflowId.toLowerCase().includes(name))) &&
        this.visibleWorkflows(document).length > 0
    );
  }

  /** The workflows of a document whose last result is the one filtered on. */
  visibleWorkflows(document: ArazzoDocumentSummary): ArazzoWorkflowSummary[] {
    return this.resultFilter
      ? document.workflows.filter((workflow) => workflow.lastResult === this.resultFilter)
      : document.workflows;
  }

  get workflowCount(): number {
    return this.documents.reduce((count, document) => count + this.visibleWorkflows(document).length, 0);
  }

  isExpanded(document: ArazzoDocumentSummary): boolean {
    return this.expandedDocumentIds.has(document.id);
  }

  toggle(document: ArazzoDocumentSummary): void {
    if (this.expandedDocumentIds.has(document.id)) {
      this.expandedDocumentIds.delete(document.id);
    } else {
      this.expandedDocumentIds.add(document.id);
    }
  }

  apiChip(source: ArazzoSourceSummary): { text: string; styleClass: string } | null {
    return source.apiType ? API_CHIPS[source.apiType] : null;
  }

  /** When the document was imported, for the timeAgo pipe; null when it is not known. */
  importedOn(document: ArazzoDocumentSummary): string | null {
    return document.importDate == null ? null : new Date(document.importDate).toISOString();
  }

  neverRun(document: ArazzoDocumentSummary): boolean {
    return document.workflows.every((workflow) => workflow.lastResult === 'NEVER_RUN');
  }

  /** How many workflows of a document had their last run end with a result. */
  lastResultCount(document: ArazzoDocumentSummary, lastResult: ArazzoLastResult): number {
    return document.workflows.filter((workflow) => workflow.lastResult === lastResult).length;
  }

  /** How the last run of a workflow went: "Passed on mocks", "Failed at readFirst". */
  lastRunOutcome(run: WorkflowRunSummary): string {
    const target = run.target === 'MOCKS' ? 'mocks' : 'implementation';
    switch (run.status) {
      case 'SUCCESS':
        return 'Passed on ' + target;
      case 'FAILURE':
        return run.failedStepId ? 'Failed at ' + run.failedStepId : 'Failed on ' + target;
      default:
        return 'In progress on ' + target;
    }
  }

  /** When a run started, for the timeAgo pipe. */
  startedOn(run: WorkflowRunSummary): string {
    return new Date(run.startedDate).toISOString();
  }

  /** Why a workflow cannot run, shown on its disabled Run button; null when it can run. */
  notRunnableReason(workflow: ArazzoWorkflowSummary): string | null {
    return workflow.status.runnable ? null : workflow.status.reasons.join(', ');
  }

  openRun(document: ArazzoDocumentSummary, workflow: ArazzoWorkflowSummary): void {
    openRunDialog(
      this.modalService,
      document.id,
      document.workflows.map((candidate) => candidate.status.workflowId),
      workflow.status.workflowId
    );
  }

  /** Open the dialog that imports an Arazzo document with the links of its sources, then list the documents again. */
  openImportDialog(): void {
    this.modalService
      .show(ImportArazzoDialogComponent, { class: 'arazzo-import-modal', ariaLabelledBy: 'arazzo-import-title' })
      .onHidden?.subscribe(() => this.getDocuments());
  }
}
