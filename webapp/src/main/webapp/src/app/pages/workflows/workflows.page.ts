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

import { ArazzoDocumentSummary, ArazzoSourceSummary } from '../../models/arazzo-document.model';
import { ServiceType } from '../../models/service.model';
import { TimeAgoPipe } from '../../components/time-ago.pipe';
import { ArazzoDocumentsService } from '../../services/arazzo-documents.service';
import { UploaderDialogService } from '../../services/uploader-dialog.service';

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
  /** The documents whose workflows are shown: the first one when the page opens. */
  expandedDocumentIds = new Set<string>();

  constructor(
    private arazzoDocumentsSvc: ArazzoDocumentsService,
    private uploaderDialogService: UploaderDialogService
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

  /** The documents using the API filtered on, whose title or one of the workflow ids contains the name filtered on. */
  get documents(): ArazzoDocumentSummary[] {
    const name = this.nameFilter.trim().toLowerCase();
    if (!name) {
      return this.apiDocuments;
    }
    return this.apiDocuments.filter(
      (document) =>
        document.title.toLowerCase().includes(name) ||
        document.workflows.some((workflow) => workflow.status.workflowId.toLowerCase().includes(name))
    );
  }

  get workflowCount(): number {
    return this.documents.reduce((count, document) => count + document.workflows.length, 0);
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

  /** Before workflows run, every workflow of a document has never run. */
  neverRun(document: ArazzoDocumentSummary): boolean {
    return document.workflows.every((workflow) => workflow.lastResult === 'NEVER_RUN');
  }

  openArtifactUploader(): void {
    this.uploaderDialogService.openArtifactUploader();
  }
}
