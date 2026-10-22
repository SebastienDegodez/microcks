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
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ArazzoDocumentsService } from './arazzo-documents.service';

describe('ArazzoDocumentsService', () => {
  let service: ArazzoDocumentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ArazzoDocumentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('analyses a document with the links chosen for its sources', () => {
    service.analyseDocument('arazzo: 1.0.1', { customerApi: { name: 'Customer API', version: '1.0.0' } }).subscribe();

    const request = http.expectOne('/api/arazzo/documents/analysis');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      content: 'arazzo: 1.0.1',
      links: { customerApi: { name: 'Customer API', version: '1.0.0' } },
    });
  });

  it('imports a document with its file name and the links of its sources', () => {
    service.importDocument('arazzo: 1.0.1', 'place-order.arazzo.yaml', { orderApi: null }).subscribe();

    const request = http.expectOne('/api/arazzo/documents');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      content: 'arazzo: 1.0.1',
      fileName: 'place-order.arazzo.yaml',
      links: { orderApi: null },
    });
  });
});
