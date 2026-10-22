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
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';

import { WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { WorkflowRunPageComponent } from './workflow-run.page';

const OUT_OF_ORDER = 'step `reserveStock` expected before `chargePayment`';

function step(index: number, stepId: string, method: string, path: string, status: 'PASSED' | 'FAILED',
              message?: string): WorkflowStepResult {
  return {
    index, stepId, operation: { sourceName: 'orderApi', operationId: stepId, method, path }, status,
    statusCode: status === 'PASSED' || message === OUT_OF_ORDER ? 201 : undefined, elapsedTime: 0, criteria: [],
    outputs: {}, message
  } as WorkflowStepResult;
}

/**
 * The verification of a session of placeOrderSaga where the saga service charged the order before reserving its items,
 * then called an operation no step calls, and never confirmed the order.
 */
function outOfOrderVerification(): WorkflowResult {
  return {
    id: 'run-5', documentId: 'doc-1', documentTitle: 'Order saga', documentVersion: '1.0.0',
    workflowId: 'placeOrderSaga', target: 'MOCKS', sources: [], inputs: {}, outputs: {}, status: 'FAILURE',
    startedDate: Date.now() - 60 * 1000, elapsedTime: 0, number: 5, origin: 'SESSION',
    steps: [
      step(0, 'createOrder', 'POST', '/orders', 'PASSED'),
      step(1, 'reserveStock', 'POST', '/reservations', 'PASSED'),
      step(2, 'chargePayment', 'POST', '/payments', 'FAILED', OUT_OF_ORDER),
      step(3, 'confirmOrder', 'POST', '/orders/{orderId}/confirm', 'FAILED', 'step `confirmOrder` missing')
    ],
    session: {
      sessionId: '6719f0c2a1b2c3d4e5f60718',
      calls: [
        { index: 0, apiName: 'Order API', apiVersion: '1.0.0', method: 'POST', path: '/orders', stepId: 'createOrder' },
        { index: 1, apiName: 'Payment API', apiVersion: '1.0.0', method: 'POST', path: '/payments', stepId: 'chargePayment' },
        { index: 2, apiName: 'Stock API', apiVersion: '1.0.0', method: 'POST', path: '/reservations', stepId: 'reserveStock' },
        { index: 3, apiName: 'Payment API', apiVersion: '1.0.0', method: 'GET', path: '/payments' }
      ]
    }
  };
}

function text(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** S15: the verification of a session reuses the run page, showing the session and the calls each step got. */
describe('WorkflowRunPageComponent verification of a session', () => {

  function open(run: WorkflowResult): HTMLElement {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-5' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(run), getExchanges: () => of([]) } },
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) }
      ]
    });
    const fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('names a verification, with a neutral Session chip and no Run again', fakeAsync(() => {
    const page = open(outOfOrderVerification());

    expect(text(page.querySelector('.workflow-run-title'))).toEqual('Verification #5 · placeOrderSaga failed');
    const subtitle = page.querySelector('.workflow-run-subtitle')!;
    expect(text(subtitle.firstChild as Element)).toEqual('Verified a minute ago against Microcks mocks');
    expect(text(subtitle.querySelector('.arazzo-run-origin'))).toEqual('Session');
    expect(page.querySelector('.workflow-run-subtitle .arazzo-run-origin')?.getAttribute('title'))
      .toEqual('Verification of the calls an application made to the mocks in a session');
    expect(page.querySelector('.workflow-run-again')).toBeNull();
  }));

  it('lists every failed step with its reason, as the calls do not stop at a failure', fakeAsync(() => {
    const page = open(outOfOrderVerification());

    const failure = page.querySelector('.workflow-run-failure');
    expect(text(failure?.querySelector('strong') ?? null))
      .toEqual('The calls of the session do not follow the workflow');
    expect(Array.from(failure?.querySelectorAll('li') ?? []).map(text)).toEqual([
      'Step 3, chargePayment: ' + OUT_OF_ORDER,
      'Step 4, confirmOrder: step `confirmOrder` missing'
    ]);
  }));

  it('shows the session and the calls it received, in their order, with the step each was matched to', fakeAsync(() => {
    const page = open(outOfOrderVerification());

    expect(text(page.querySelector('.workflow-run-session dd'))).toEqual('6719f0c2a1b2c3d4e5f60718');
    expect(Array.from(page.querySelectorAll('.workflow-run-session-call')).map(text)).toEqual([
      '#1 POST /orders → createOrder', '#2 POST /payments → chargePayment', '#3 POST /reservations → reserveStock',
      '#4 GET /payments → no step'
    ]);
    expect(page.querySelector('.workflow-run-session-call-unmatched')?.getAttribute('title'))
      .toEqual('Payment API 1.0.0: this call matches no step of the workflow');
    expect(page.querySelector('.workflow-run-inputs')).toBeNull();
    expect(page.querySelector('.workflow-run-schema-validation')).toBeNull();
  }));

  it('gives each step the order index of its call, and tells a step that received none', fakeAsync(() => {
    const page = open(outOfOrderVerification());

    expect(Array.from(page.querySelectorAll('.workflow-run-step')).map(row =>
      text(row.querySelector('.workflow-run-step-title')) + ' | '
        + text(row.querySelector('.workflow-run-step-call')) + ' | '
        + text(row.querySelector('.workflow-run-step-result')))).toEqual([
      '1 · createOrder | call #1 | 201 · 0 ms',
      '2 · reserveStock | call #3 | 201 · 0 ms',
      '3 · chargePayment | call #2 | 201 · 0 ms',
      '4 · confirmOrder |  | No call received'
    ]);
  }));

  it('keeps the inputs and the schema validation of a run', fakeAsync(() => {
    const run = outOfOrderVerification();
    delete run.origin;
    delete run.session;
    const page = open(run);

    expect(page.querySelector('.workflow-run-inputs')).not.toBeNull();
    expect(page.querySelector('.workflow-run-schema-validation')).not.toBeNull();
    expect(page.querySelector('.workflow-run-step-call')).toBeNull();
  }));
});
