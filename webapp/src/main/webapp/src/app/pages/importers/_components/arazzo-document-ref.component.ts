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
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ArazzoDocumentRef } from '../../../models/importer.model';

/**
 * The Arazzo document an import job imported, under the URL of the job: its title and version, and the sources of the
 * document its last import left linked to no API.
 */
@Component({
  selector: 'app-arazzo-document-ref',
  template: `
    <div class="arazzo-document-ref">
      <span class="pficon pficon-process-automation" aria-hidden="true"></span>
      Arazzo document <a [routerLink]="['/workflows']">{{ ref().title }} {{ ref().version }}</a>
    </div>
    @if (ref().unlinkedSources.length > 0) {
      <div class="arazzo-document-ref-unlinked">
        <span class="pficon pficon-warning-triangle-o" aria-hidden="true"></span>
        {{ unlinkedSources() }} not linked at the last import: link
        {{ ref().unlinkedSources.length === 1 ? 'it' : 'them' }} from the
        <a [routerLink]="['/workflows']">Workflows page</a>
      </div>
    }
  `,
  styles: `
    .arazzo-document-ref,
    .arazzo-document-ref-unlinked {
      margin-top: 4px;
      font-size: 12px;
    }
    .arazzo-document-ref .pficon,
    .arazzo-document-ref-unlinked .pficon {
      margin-right: 4px;
    }
    .arazzo-document-ref-unlinked {
      color: var(--warning-text);
    }
  `,
  imports: [RouterLink],
})
export class ArazzoDocumentRefComponent {
  ref = input.required<ArazzoDocumentRef>();

  /** "orderApi", "customerApi and orderApi", "a, b and c". */
  unlinkedSources = computed(() => {
    const names = this.ref().unlinkedSources;
    return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  });
}
