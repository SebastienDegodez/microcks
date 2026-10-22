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
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';

import { ArazzoWorkflowDetail } from '../../../models/arazzo-workflow.model';
import { ArazzoRunHistoryService } from '../../../services/arazzo-run-history.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { FakeRunHistory } from '../../../../test-data/arazzo-run-history';
import { listenOnChannels, placeThenConfirm } from '../../../../test-data/order-events';
import { WorkflowDetailPageComponent } from './workflow-detail.page';

/**
 * S28, AC-02: the workflow page shows the steps of an AsyncAPI source with what they send or receive, on which channel
 * and through which operation, with their correlationId and timeout, in the colour of event-driven APIs.
 */
describe('WorkflowDetailPageComponent of a workflow whose steps send or receive messages', () => {
  let page: HTMLElement;

  async function open(workflow: ArazzoWorkflowDetail, view = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/:documentId/:workflowId', component: WorkflowDetailPageComponent }]),
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: () => of(workflow) } },
        { provide: ArazzoRunHistoryService, useValue: new FakeRunHistory([], 'events-doc') }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workflows/events-doc/' + workflow.workflowId + view, WorkflowDetailPageComponent);
    page = harness.routeNativeElement as HTMLElement;
  }

  function texts(selector: string, root: ParentNode = page): string[] {
    return Array.from(root.querySelectorAll(selector)).map(element => (element.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function step(stepId: string): HTMLElement {
    return page.querySelector('[data-step-id="' + stepId + '"]') as HTMLElement;
  }

  function diagramNode(id: string): HTMLElement {
    return page.querySelector('.diagram-node[data-node-id="' + id + '"]') as HTMLElement;
  }

  describe('steps view', () => {

    it('heads an async step with the event chip, its action and channel, and its operation', async () => {
      await open(placeThenConfirm());

      expect(texts('.workflow-step-operation', step('confirmOrder'))).toEqual(['EVENT RECEIVE orders/confirmed receiveOrderConfirmed']);
      expect(texts('.workflow-step-operation', step('requestShipping'))).toEqual(['EVENT SEND shipping/requests sendShippingRequest']);
      expect(texts('.workflow-step-operation', step('createOrder'))).toEqual(['REST POST /orders CreateOrder']);
      expect(step('confirmOrder').querySelector('.workflow-protocol-chip')?.classList).toContain('workflow-protocol-event');
      expect(step('createOrder').querySelector('.workflow-protocol-chip')?.classList).not.toContain('workflow-protocol-event');
      expect(step('confirmOrder').querySelector('.workflow-step-operation a')?.getAttribute('href')).toEqual('/services/svc-events');
    });

    it('lists the message exchange of an async step: action, channel, correlationId and timeout', async () => {
      await open(placeThenConfirm());

      expect(texts('.workflow-step-messaging', step('confirmOrder'))).toEqual([
        'Action receive', 'Channel orders/confirmed', 'Correlation id ← $steps.createOrder.outputs.orderId', 'Timeout 6000 ms'
      ]);
      expect(texts('.workflow-step-messaging', step('requestShipping'))).toEqual(['Action send', 'Channel shipping/requests']);
      expect(texts('.workflow-step-section', step('confirmOrder'))).toContain('Message exchange');
      expect(texts('.workflow-step-section', step('createOrder'))).not.toContain('Message exchange');
    });

    it('tells which earlier output is the correlationId of a receive step', async () => {
      await open(placeThenConfirm());

      expect(texts('.workflow-data-passing')).toContain('createOrder.outputs.orderId is the correlationId of confirmOrder');
    });

    it('heads a step on a channel with its channel, and a channel not found with its reason', async () => {
      await open(listenOnChannels());

      expect(texts('.workflow-step-operation', step('confirmed'))).toEqual(['EVENT RECEIVE orders/confirmed']);
      expect(texts('.workflow-step-operation', step('shipped')))
        .toEqual(['orderShipped Channel orderShipped not found in Order events 1.0.0']);
      expect(texts('.workflow-step-messaging', step('shipped'))).toEqual(['Action receive']);
    });

    it('shows the action of its AsyncAPI operation for a step that does not tell its own', async () => {
      await open(listenOnChannels());

      expect(texts('.workflow-step-operation', step('legacy'))).toEqual(['EVENT SUBSCRIBE orders/confirmed receiveOrderConfirmed']);
      expect(texts('.workflow-step-messaging', step('legacy'))).toEqual(['Action subscribe', 'Channel orders/confirmed']);
    });
  });

  describe('diagram view', () => {

    it('draws an async step in the event colour, with its action, channel, correlationId and timeout', async () => {
      await open(placeThenConfirm(), '?view=diagram');

      expect(diagramNode('step:confirmOrder').classList).toContain('diagram-node-event');
      expect(diagramNode('step:createOrder').classList).not.toContain('diagram-node-event');
      expect(texts('.diagram-step-endpoint', diagramNode('step:confirmOrder'))).toEqual(['EVENT RECEIVE orders/confirmed']);
      expect(texts('.diagram-step-operation', diagramNode('step:confirmOrder'))).toEqual(['receiveOrderConfirmed']);
      expect(texts('.diagram-step-messaging', diagramNode('step:confirmOrder')))
        .toEqual(['correlationId ← $steps.createOrder.outputs.orderId · timeout 6000 ms']);
      expect(texts('.diagram-step-messaging', diagramNode('step:requestShipping'))).toEqual([]);
    });

    it('draws the data an output gives to the correlationId of a receive step', async () => {
      await open(placeThenConfirm(), '?view=diagram');

      expect(texts('.diagram-data-label[data-to="step:confirmOrder"]')).toEqual(['outputs.orderId → correlationId']);
    });

    it('draws a step on a channel without operation, and a channel not found with its reason', async () => {
      await open(listenOnChannels(), '?view=diagram');

      expect(texts('.diagram-step-endpoint', diagramNode('step:confirmed'))).toEqual(['EVENT RECEIVE orders/confirmed']);
      expect(texts('.diagram-step-operation', diagramNode('step:confirmed'))).toEqual([]);
      expect(texts('.diagram-step-operation', diagramNode('step:shipped')))
        .toEqual(['orderShipped Channel orderShipped not found in Order events 1.0.0']);
      expect(diagramNode('step:shipped').classList).toContain('diagram-node-problem');
    });
  });
});
