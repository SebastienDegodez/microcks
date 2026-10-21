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
 * The Arazzo document an import job imported, next to the labels of the job: a link to the Workflows page, and the
 * sources of the document that are still linked to no API.
 */
@Component({
  selector: 'app-arazzo-document-ref',
  template: `
    <span class="label label-warning" [title]="'Arazzo document ' + ref().title + ' ' + ref().version">
      <a [routerLink]="['/workflows']">Workflows</a>
    </span>
    @if (unlinkedCount() > 0) {
      <span class="label label-warning" [title]="unlinkedTitle()">
        {{ unlinkedCount() }} {{ unlinkedCount() === 1 ? 'source' : 'sources' }} not linked
      </span>
    }
  `,
  imports: [RouterLink],
})
export class ArazzoDocumentRefComponent {
  ref = input.required<ArazzoDocumentRef>();

  unlinkedCount = computed(() => this.ref().unlinkedSources.length);

  unlinkedTitle = computed(
    () =>
      this.ref().unlinkedSources.join(', ') +
      ' not linked: link ' +
      (this.unlinkedCount() === 1 ? 'it' : 'them') +
      ' from the Workflows page'
  );
}
