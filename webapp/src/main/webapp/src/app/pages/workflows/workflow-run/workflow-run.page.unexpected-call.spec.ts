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

const UNEXPECTED = 'unexpected call `confirmOrder` after `chargePayment`';

function step(index: number, stepId: string, method: string, path: string, statusCode: number): WorkflowStepResult {
  return {
    index, stepId, operation: { sourceName: 'orderApi', operationId: stepId, method, path }, status: 'PASSED',
    statusCode, elapsedTime: 0, criteria: [], outputs: {}
  } as WorkflowStepResult;
}

/**
 * The verification of a session of compensatePaymentRefused where chargePayment answered card refused, and the saga
 * service still confirmed the order before releasing its stock and cancelling it.
 */
function confirmedAfterRefusal(): WorkflowResult {
  return {
    id: 'run-7', documentId: 'doc-1', documentTitle: 'Order saga', documentVersion: '1.0.0',
    workflowId: 'compensatePaymentRefused', target: 'MOCKS', sources: [], inputs: {}, outputs: {}, status: 'FAILURE',
    startedDate: Date.now() - 60 * 1000, elapsedTime: 0, number: 7, origin: 'SESSION',
    steps: [
      step(0, 'createOrder', 'POST', '/orders', 201),
      step(1, 'reserveStock', 'POST', '/reservations', 201),
      step(2, 'chargePayment', 'POST', '/payments', 402),
      step(3, 'releaseStock', 'DELETE', '/reservations/{reservationId}', 200),
      step(4, 'cancelOrder', 'POST', '/orders/{orderId}/cancel', 200)
    ],
    session: {
      sessionId: '6719f0c2a1b2c3d4e5f60719',
      calls: [
        { index: 0, apiName: 'Order API', apiVersion: '1.0.0', method: 'POST', path: '/orders', stepId: 'createOrder' },
        { index: 1, apiName: 'Stock API', apiVersion: '1.0.0', method: 'POST', path: '/reservations', stepId: 'reserveStock' },
        { index: 2, apiName: 'Payment API', apiVersion: '1.0.0', method: 'POST', path: '/payments', stepId: 'chargePayment' },
        { index: 3, apiName: 'Order API', apiVersion: '1.0.0', method: 'POST', path: '/orders/o-42/confirm', failure: UNEXPECTED },
        { index: 4, apiName: 'Stock API', apiVersion: '1.0.0', method: 'DELETE', path: '/reservations/r-9', stepId: 'releaseStock' },
        { index: 5, apiName: 'Order API', apiVersion: '1.0.0', method: 'POST', path: '/orders/o-42/cancel', stepId: 'cancelOrder' },
        { index: 6, apiName: 'Notification API', apiVersion: '1.0.0', method: 'POST', path: '/notifications' }
      ]
    }
  };
}

function text(element: Element | null): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** S17: a call no remaining step of the workflow expects fails the verification of a session, telling which one. */
describe('WorkflowRunPageComponent verification with an unexpected call', () => {

  function open(run: WorkflowResult): HTMLElement {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-7' })) } },
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

  it('lists the unexpected call with its reason, although every step passed', fakeAsync(() => {
    const page = open(confirmedAfterRefusal());

    const failure = page.querySelector('.workflow-run-session-failure');
    expect(text(failure?.querySelector('strong') ?? null))
      .toEqual('The calls of the session do not follow the workflow');
    expect(Array.from(failure?.querySelectorAll('li') ?? []).map(text)).toEqual([
      'Call #4, POST /orders/o-42/confirm: ' + UNEXPECTED
    ]);
  }));

  it('marks the unexpected call among the received calls, apart from a call to an API no source is linked to',
    fakeAsync(() => {
      const page = open(confirmedAfterRefusal());

      expect(Array.from(page.querySelectorAll('.workflow-run-session-call')).map(text)).toEqual([
        '#1 POST /orders → createOrder', '#2 POST /reservations → reserveStock', '#3 POST /payments → chargePayment',
        '#4 POST /orders/o-42/confirm → unexpected', '#5 DELETE /reservations/r-9 → releaseStock',
        '#6 POST /orders/o-42/cancel → cancelOrder', '#7 POST /notifications → no step'
      ]);
      const unexpected = page.querySelectorAll('.workflow-run-session-call-unexpected');
      expect(unexpected.length).toEqual(1);
      expect(unexpected[0].getAttribute('title')).toEqual('Order API 1.0.0: ' + UNEXPECTED);
    }));
});
