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
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ArazzoRunService } from './arazzo-run.service';

describe('ArazzoRunService', () => {
  let service: ArazzoRunService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ArazzoRunService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('launches a run against the mocks with its inputs and timeout', () => {
    service.launchRun('doc 1', 'readThenReprice', { pastry: 'Eclair Cafe' }, 10000).subscribe();

    const request = http.expectOne('/api/arazzo/documents/doc%201/workflows/readThenReprice/runs');
    expect(request.request.method).toEqual('POST');
    expect(request.request.body).toEqual({ inputs: { pastry: 'Eclair Cafe' }, timeout: 10000, validateSchema: false });
    request.flush({ id: 'run-1' });
  });

  it('launches a run against implementations with the base URL of each source and the secret', () => {
    service.launchRun('doc-1', 'readThenReprice', {}, 5000,
      { baseUrls: { pastryApi: 'http://localhost:8080' }, secretName: 'pastry-staging-token' }).subscribe();

    const request = http.expectOne('/api/arazzo/documents/doc-1/workflows/readThenReprice/runs');
    expect(request.request.body).toEqual({ inputs: {}, timeout: 5000,
      implementations: { pastryApi: 'http://localhost:8080' }, secretName: 'pastry-staging-token', validateSchema: false });
    request.flush({ id: 'run-1' });
  });

  it('launches the run of a recorded example, which plays the inputs of the example', () => {
    service.launchRun('doc-1', 'readThenReprice', { pastry: 'Eclair Cafe', newPrice: 2.6 }, 10000, undefined, true,
      'eclair-repriced').subscribe();

    const request = http.expectOne('/api/arazzo/documents/doc-1/workflows/readThenReprice/runs');
    expect(request.request.body).toEqual({ inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 }, timeout: 10000,
      validateSchema: true, example: 'eclair-repriced' });
    request.flush({ id: 'run-1' });
  });

  it('runs all the recorded examples of a workflow in one call', () => {
    let launches: unknown;
    service.launchExampleRuns('doc 1', 'readThenReprice', 5000,
      { baseUrls: { pastryApi: 'http://localhost:8080' } }, true).subscribe(answer => launches = answer);

    const request = http.expectOne('/api/arazzo/documents/doc%201/workflows/readThenReprice/examples/runs');
    expect(request.request.method).toEqual('POST');
    expect(request.request.body).toEqual({ timeout: 5000, implementations: { pastryApi: 'http://localhost:8080' },
      secretName: undefined, validateSchema: true });
    request.flush([{ example: 'eclair-repriced', runId: 'run-1', number: 1 }]);
    expect(launches).toEqual([{ example: 'eclair-repriced', runId: 'run-1', number: 1 }]);
  });
});
