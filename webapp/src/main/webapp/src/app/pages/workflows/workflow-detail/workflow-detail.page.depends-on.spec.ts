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
import { tasteThenReprice } from '../../../../test-data/pastry-tasting';
import { WorkflowDetailPageComponent } from './workflow-detail.page';

/**
 * S30, AC-03: the workflow page shows the steps each step declares it depends on (dependsOn, Arazzo 1.1): as chips in
 * the Steps view, and as edges from the steps it must come after in the Diagram view, where the steps that only depend
 * on the same steps stand side by side.
 */
describe('WorkflowDetailPageComponent of a workflow whose steps declare dependsOn', () => {
  let page: HTMLElement;

  async function open(workflow: ArazzoWorkflowDetail, view = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/:documentId/:workflowId', component: WorkflowDetailPageComponent }]),
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: () => of(workflow) } },
        { provide: ArazzoRunHistoryService, useValue: new FakeRunHistory([], 'tasting-doc') }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workflows/tasting-doc/' + workflow.workflowId + view, WorkflowDetailPageComponent);
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

    it('heads a step with a chip for each step it declares it depends on', async () => {
      const workflow = tasteThenReprice();
      workflow.steps[2].dependsOn = ['readMenu', 'tasteEclair'];
      await open(workflow);

      expect(texts('.workflow-depends-on', step('tasteEclair'))).toEqual(['depends on readMenu']);
      expect(texts('.workflow-depends-on', step('tasteMillefeuille'))).toEqual(['depends on readMenu', 'depends on tasteEclair']);
      expect(step('tasteEclair').querySelector('.workflow-step-heading .workflow-depends-on')).not.toBeNull();
    });

    it('shows no chip on a step that declares no dependsOn, nor on the steps of an older document', async () => {
      const workflow = tasteThenReprice();
      workflow.steps[1].dependsOn = undefined;
      await open(workflow);

      expect(texts('.workflow-depends-on', step('readMenu'))).toEqual([]);
      expect(texts('.workflow-depends-on', step('reprice'))).toEqual([]);
      expect(texts('.workflow-depends-on', step('tasteEclair'))).toEqual([]);
    });
  });

  describe('diagram view', () => {

    it('draws the steps that only depend on readMenu side by side, each linked from it and to reprice', async () => {
      await open(tasteThenReprice(), '?view=diagram');

      const tastes = ['step:tasteEclair', 'step:tasteMillefeuille', 'step:tasteEclairXml'].map(diagramNode);
      tastes.forEach(taste => expect(taste.style.top).withContext(taste.dataset['nodeId']!).toEqual(tastes[0].style.top));
      expect(new Set(tastes.map(taste => taste.style.left)).size).toEqual(3);
      const from = (id: string) => Array.from(page.querySelectorAll('.diagram-edge-sequence[data-to="' + id + '"]'))
        .map(edge => edge.getAttribute('data-from'));
      expect(from('step:tasteMillefeuille')).toEqual(['step:readMenu']);
      expect(from('step:reprice')).toEqual(['step:tasteEclair', 'step:tasteMillefeuille', 'step:tasteEclairXml']);
    });
  });
});
