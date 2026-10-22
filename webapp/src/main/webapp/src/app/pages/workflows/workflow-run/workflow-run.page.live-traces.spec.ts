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
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';
import { HighlightJS } from 'ngx-highlightjs';

import { WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { Header, RequestResponsePair } from '../../../models/service.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { WorkflowRunPageComponent } from './workflow-run.page';

const MICROCKS = 'http://localhost:8080';
const BAGGAGE = 'microcks-arazzo-run=run-1,microcks-arazzo-workflow=readThenReprice,microcks-arazzo-step=readPastry,'
  + 'microcks-arazzo-attempt=1';

function step(index: number, stepId: string): WorkflowStepResult {
  return { index, stepId, status: 'PASSED', statusCode: 200, elapsedTime: 8, criteria: [], outputs: {},
    operation: { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET', path: '/pastry/{name}' },
    testCaseId: 'run-1-' + index, requestUrl: MICROCKS + '/rest/API+Pastry+-+2.0/2.0.0/pastry/Eclair%20Cafe',
    parameters: [{ name: 'name', in: 'path', value: 'Eclair Cafe', expression: '$inputs.pastry' }] };
}

/** A run of readThenReprice, as GET /api/arazzo/runs/run-1 answers it. */
function run(target: WorkflowResult['target']): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target, sources: [], inputs: { pastry: 'Eclair Cafe' }, outputs: {},
    status: 'SUCCESS', startedDate: Date.now() - 60 * 1000, elapsedTime: 13, timeout: 10000,
    steps: [step(0, 'readPastry')]
  };
}

/** The request the step sent, with these headers, and the response it received. */
function exchange(headers: Header[]): RequestResponsePair[] {
  return [{ type: 'reqRespPair',
    request: { name: 'readPastry', headers } as unknown as RequestResponsePair['request'],
    response: { name: 'readPastry', status: '200', content: '{}', mediaType: 'application/json', headers: [] } as
      unknown as RequestResponsePair['response'] }];
}

describe('WorkflowRunPageComponent and Live Traces', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;

  function open(shown: WorkflowResult, headers: Header[]): void {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(shown), getExchanges: () => of(exchange(headers)) } },
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
        { provide: HighlightJS, useValue: { highlightAuto: () => new Promise(() => undefined) } }
      ]
    });
    fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-step-id="readPastry"] .workflow-run-step-toggle')!.click();
    fixture.detectChanges();
  }

  function baggage(): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.workflow-run-baggage'))
      .map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  it('shows the baggage the request of a step sent to the mocks, which marks it in Live Traces', fakeAsync(() => {
    open(run('MOCKS'), [{ name: 'baggage', values: [BAGGAGE] }]);

    expect(baggage()).toEqual(['Baggage ' + BAGGAGE]);
    const hint = (fixture.nativeElement as HTMLElement).querySelector('.workflow-run-baggage code') as HTMLElement;
    expect(hint.title).toBe('Marks this call in the Live Traces of the API');
  }));

  it('shows the baggage whatever the case of its header', fakeAsync(() => {
    open(run('MOCKS'), [{ name: 'Accept', values: ['application/json'] },
      { name: 'Baggage', values: ['tenant=bakery', BAGGAGE] }]);

    expect(baggage()).toEqual(['Baggage tenant=bakery,' + BAGGAGE]);
  }));

  it('shows no baggage for a request that sent none, such as one to an implementation', fakeAsync(() => {
    open(run('IMPLEMENTATIONS'), [{ name: 'Accept', values: ['application/json'] }]);

    expect(baggage()).toEqual([]);
  }));
});
