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
  function show(unlinkedSources: string[]): ComponentFixture<ArazzoDocumentRefComponent> {
    const ref: ArazzoDocumentRef = { documentId: 'order-doc', title: 'Order fulfilment', version: '1.0.0', unlinkedSources };
    TestBed.configureTestingModule({ imports: [ArazzoDocumentRefComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ArazzoDocumentRefComponent);
    fixture.componentRef.setInput('ref', ref);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<ArazzoDocumentRefComponent>, selector: string): string {
    const node = (fixture.nativeElement as HTMLElement).querySelector(selector);
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('names the Arazzo document a job imported, linked to the Workflows page', () => {
    const fixture = show([]);

    expect(text(fixture, '.arazzo-document-ref')).toBe('Arazzo document Order fulfilment 1.0.0');
    const link = (fixture.nativeElement as HTMLElement).querySelector('.arazzo-document-ref a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/workflows');
    expect((fixture.nativeElement as HTMLElement).querySelector('.arazzo-document-ref-unlinked')).toBeNull();
  });

  it('tells which source of the document its last import left linked to no API', () => {
    const fixture = show(['orderApi']);

    expect(text(fixture, '.arazzo-document-ref-unlinked')).toBe(
      'orderApi not linked at the last import: link it from the Workflows page'
    );
    const link = (fixture.nativeElement as HTMLElement).querySelector('.arazzo-document-ref-unlinked a');
    expect(link?.getAttribute('href')).toBe('/workflows');
  });

  it('names every source linked to no API', () => {
    const fixture = show(['customerApi', 'orderApi', 'paymentApi']);

    expect(text(fixture, '.arazzo-document-ref-unlinked')).toBe(
      'customerApi, orderApi and paymentApi not linked at the last import: link them from the Workflows page'
    );
  });
});
