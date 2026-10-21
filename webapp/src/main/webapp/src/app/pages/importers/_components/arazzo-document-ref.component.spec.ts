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
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ArazzoDocumentRef } from '../../../models/importer.model';
import { ArazzoDocumentRefComponent } from './arazzo-document-ref.component';

describe('ArazzoDocumentRefComponent', () => {
  function show(ref: ArazzoDocumentRef): ComponentFixture<ArazzoDocumentRefComponent> {
    TestBed.configureTestingModule({ imports: [ArazzoDocumentRefComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ArazzoDocumentRefComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();
    return fixture;
  }

  function labels(fixture: ComponentFixture<ArazzoDocumentRefComponent>): { text: string; title: string | null }[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.label')).map((label) => ({
      text: (label.textContent ?? '').replace(/\s+/g, ' ').trim(),
      title: label.getAttribute('title'),
    }));
  }

  it('links the Arazzo document a job imported to the Workflows page', () => {
    const fixture = show({ documentId: 'order-doc', title: 'Order fulfilment', version: '1.0.0', unlinkedSources: [] });

    expect(labels(fixture)).toEqual([{ text: 'Workflows', title: 'Arazzo document Order fulfilment 1.0.0' }]);
    const link = (fixture.nativeElement as HTMLElement).querySelector('.label a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/workflows');
  });

  it('tells which sources of the document are linked to no API', () => {
    const fixture = show({
      documentId: 'order-doc',
      title: 'Order fulfilment',
      version: '1.0.0',
      unlinkedSources: ['customerApi', 'orderApi'],
    });

    expect(labels(fixture)[1]).toEqual({
      text: '2 sources not linked',
      title: 'customerApi, orderApi not linked: link them from the Workflows page',
    });
  });

  it('counts a single source not linked in the singular', () => {
    const fixture = show({
      documentId: 'order-doc',
      title: 'Order fulfilment',
      version: '1.0.0',
      unlinkedSources: ['orderApi'],
    });

    expect(labels(fixture)[1]).toEqual({
      text: '1 source not linked',
      title: 'orderApi not linked: link it from the Workflows page',
    });
  });
});
