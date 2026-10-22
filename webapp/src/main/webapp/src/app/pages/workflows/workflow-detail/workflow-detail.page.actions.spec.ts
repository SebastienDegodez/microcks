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
import { readUnlessPreparing, waitUntilReady } from '../../../../test-data/order-tracking';
import { WorkflowDetailPageComponent } from './workflow-detail.page';

/** S17, AC-05: the workflow page shows what each step does on success and on failure, in its steps and diagram views. */
describe('WorkflowDetailPageComponent of a workflow whose steps retry or end it', () => {
  let page: HTMLElement;

  async function open(workflow: ArazzoWorkflowDetail, view = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/:documentId/:workflowId', component: WorkflowDetailPageComponent }]),
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: () => of(workflow) } },
        { provide: ArazzoRunHistoryService, useValue: new FakeRunHistory([], 'order-doc') }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workflows/order-doc/' + workflow.workflowId + view, WorkflowDetailPageComponent);
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

    it('lists the retry of a step with its delay and limit', async () => {
      await open(waitUntilReady());

      expect(texts('.workflow-step-action', step('pollStatus'))).toEqual(['On failure: retry every 1 s, up to 5 times']);
      expect(step('pollStatus').querySelector('.workflow-step-action')?.getAttribute('title')).toEqual('notReadyYet');
      expect(texts('.workflow-step-action', step('readOrder'))).toEqual([]);
      expect(texts('.workflow-step-section', step('readOrder'))).not.toContain('Actions');
    });

    it('lists the actions ending the workflow, with the criteria they apply on', async () => {
      await open(readUnlessPreparing());

      expect(texts('.workflow-step-section', step('checkStatus'))).toContain('Actions');
      expect(texts('.workflow-step-action', step('checkStatus'))).toEqual([
        'On success: end the workflow when $response.body#/status == \'preparing\'',
        'On failure: end the workflow'
      ]);
    });

    it('words a retry without delay, or with a single retry', async () => {
      const workflow = waitUntilReady();
      workflow.steps[0].onFailure = [
        { name: 'atOnce', type: 'retry', retryAfter: 0, retryLimit: 1, criteria: [] },
        { name: 'later', type: 'retry', retryAfter: 0.5, retryLimit: 3,
          criteria: [{ condition: '^prep', context: '$response.body#/status', type: 'regex' }] }
      ];
      await open(workflow);

      expect(texts('.workflow-step-action', step('pollStatus'))).toEqual([
        'On failure: retry at once, up to 1 time',
        'On failure: retry every 0.5 s, up to 3 times when ^prep on $response.body#/status'
      ]);
    });
  });

  describe('diagram view', () => {

    it('draws the retry loop on the step, labelled with its limit and delay', async () => {
      await open(waitUntilReady(), '?view=diagram');

      const loops = Array.from(page.querySelectorAll('.diagram-edge-retry'));
      expect(loops.map(loop => loop.getAttribute('data-from') + ' → ' + loop.getAttribute('data-to')))
        .toEqual(['step:pollStatus → step:pollStatus']);
      expect(texts('.diagram-action-label')).toEqual(['retry ×5 · 1 s']);
      expect(texts('.diagram-step-action', diagramNode('step:pollStatus')))
        .toEqual(['On failure: retry every 1 s, up to 5 times']);
    });

    it('draws an exit for each action ending the workflow', async () => {
      await open(readUnlessPreparing(), '?view=diagram');

      expect(Array.from(page.querySelectorAll('.diagram-edge-end')).map(exit => exit.getAttribute('data-from')))
        .toEqual(['step:checkStatus', 'step:checkStatus']);
      expect(texts('.diagram-action-label')).toEqual(['end on success', 'end on failure']);
      expect(page.querySelectorAll('.diagram-edge-retry').length).toEqual(0);
    });
  });
});
