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
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BsModalRef } from 'ngx-bootstrap/modal';

import {
  ArazzoApiRef,
  ArazzoImportAnalysis,
  ArazzoSourceAnalysis,
  ArazzoSourceLinks,
} from '../../../models/arazzo-document.model';
import { ArazzoDocumentsService } from '../../../services/arazzo-documents.service';
import { UploaderDialogService } from '../../../services/uploader-dialog.service';

/** What the dialog says under the API picked for a source. */
export interface SourceHint {
  text: string;
  kind: 'matched' | 'missing' | 'unreadable';
}

/**
 * Imports an Arazzo document and links its source descriptions to Microcks APIs in one go: the document is analysed
 * when dropped and again each time a link changes, then imported with its links.
 */
@Component({
  selector: 'app-import-arazzo-dialog',
  templateUrl: './import-arazzo-dialog.component.html',
  styleUrls: ['./import-arazzo-dialog.component.css'],
  imports: [CommonModule, FormsModule],
})
export class ImportArazzoDialogComponent {
  fileName?: string;
  content?: string;
  analysis?: ArazzoImportAnalysis;
  /** The option picked for each source description, by name: the key of an API, or '' when it is not linked. */
  choices: Record<string, string> = {};
  dragging = false;
  importing = false;
  importError?: string;

  constructor(
    public bsModalRef: BsModalRef,
    private arazzoDocumentsSvc: ArazzoDocumentsService,
    private uploaderDialogService: UploaderDialogService
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging = true;
  }

  onDragLeave(): void {
    this.dragging = false;
  }

  onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging = false;
    const file = event.dataTransfer?.files[0];
    return file ? this.selectFile(file) : Promise.resolve();
  }

  onFileChosen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    return file ? this.selectFile(file) : Promise.resolve();
  }

  /** Read a dropped or chosen file, then analyse it. */
  async selectFile(file: File): Promise<void> {
    this.content = await file.text();
    this.fileName = file.name;
    this.importError = undefined;
    this.analyse();
  }

  get valid(): boolean {
    return this.analysis != null && this.analysis.refusal == null;
  }

  get canImport(): boolean {
    return this.valid && !this.importing;
  }

  linkedCount(analysis: ArazzoImportAnalysis): number {
    return analysis.sources.filter((source) => source.link.linked).length;
  }

  /** The sources whose contract names an API absent from Microcks, and that are not linked. */
  missingSources(analysis: ArazzoImportAnalysis): ArazzoSourceAnalysis[] {
    return analysis.sources.filter((source) => !source.link.linked && source.match.status === 'NO_API');
  }

  apiKey(api: ArazzoApiRef): string {
    return JSON.stringify([api.name, api.version]);
  }

  /** Link a source to the API picked in its list, or to none, then analyse the document again with the links. */
  pick(sourceName: string, choice: string): void {
    this.choices[sourceName] = choice;
    this.analyse(this.links());
  }

  hint(source: ArazzoSourceAnalysis): SourceHint | null {
    const match = source.match;
    if (source.link.linked) {
      const matched =
        match.status === 'MATCHED' &&
        source.link.apiName === match.contractTitle &&
        source.link.apiVersion === match.contractVersion;
      return matched ? { text: 'Matched on title and version', kind: 'matched' } : null;
    }
    if (match.status === 'NO_API') {
      return {
        text: `No API titled “${match.contractTitle}” ${match.contractVersion} in Microcks`,
        kind: 'missing',
      };
    }
    if (match.status === 'UNREADABLE') {
      return { text: 'Pick the API: the declared URL cannot be read', kind: 'unreadable' };
    }
    return null;
  }

  /** A source that is not linked is a warning, unless its contract cannot be read and its API is left to pick. */
  isWarning(source: ArazzoSourceAnalysis): boolean {
    return !source.link.linked && source.match.status !== 'UNREADABLE';
  }

  allFound(source: ArazzoSourceAnalysis): boolean {
    return source.link.linked && source.foundOperationCount === source.operationCount;
  }

  /** The name of the file at a url: the last segment of its path. */
  fileNameOf(url: string): string {
    const path = url.split(/[?#]/)[0];
    return path.substring(path.lastIndexOf('/') + 1);
  }

  /** Import the contract of a missing API with the generic import dialog, then match the sources again. */
  importMissingApi(source: ArazzoSourceAnalysis): void {
    this.uploaderDialogService.openArtifactDownloadWithUrl(source.declaredUrl).onHidden?.subscribe(() => this.analyse());
  }

  /** "A", "A and B", "A, B and C". */
  joined(names: string[]): string {
    return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  }

  importDocument(): void {
    this.importing = true;
    this.importError = undefined;
    this.arazzoDocumentsSvc.importDocument(this.content as string, this.fileName as string, this.links()).subscribe({
      next: () => {
        this.importing = false;
        this.bsModalRef.hide();
      },
      error: (error: HttpErrorResponse) => {
        this.importing = false;
        this.importError = typeof error.error === 'string' ? error.error : error.message;
      },
    });
  }

  private analyse(links?: ArazzoSourceLinks): void {
    this.arazzoDocumentsSvc.analyseDocument(this.content as string, links).subscribe((analysis) => {
      this.analysis = analysis;
      this.choices = {};
      for (const source of analysis.sources) {
        this.choices[source.sourceName] = source.link.linked
          ? this.apiKey({ name: source.link.apiName as string, version: source.link.apiVersion as string })
          : '';
      }
    });
  }

  private links(): ArazzoSourceLinks {
    const links: ArazzoSourceLinks = {};
    for (const [sourceName, choice] of Object.entries(this.choices)) {
      if (choice) {
        const [name, version] = JSON.parse(choice) as [string, string];
        links[sourceName] = { name, version };
      } else {
        links[sourceName] = null;
      }
    }
    return links;
  }
}
