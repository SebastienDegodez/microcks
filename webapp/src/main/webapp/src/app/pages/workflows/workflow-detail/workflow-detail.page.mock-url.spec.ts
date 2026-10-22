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
import { WorkflowDetailPageComponent } from './workflow-detail.page';

/** S27, AC-01: the Mock URL of a workflow is shown inside its tab. */
describe('WorkflowDetailPageComponent Mock URL', () => {

  function workflow(workflowId: string): ArazzoWorkflowDetail {
    return {
      documentId: 'doc-1', title: 'API Pastry scenarios', version: '1.0.0', arazzoVersion: '1.0.1',
      importDate: Date.now(), workflowIds: ['readThenReprice', 'listThenReadFirst'], sources: [],
      workflowId, inputs: [], steps: [], outputs: {}, dataPassings: [],
      status: { workflowId, runnable: true, reasons: [] }
    };
  }

  async function open(workflowId: string): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/:documentId/:workflowId', component: WorkflowDetailPageComponent }]),
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: () => of(workflow(workflowId)) } },
        { provide: ArazzoRunHistoryService, useValue: new FakeRunHistory([], 'doc-1') }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workflows/doc-1/' + workflowId, WorkflowDetailPageComponent);
    return harness.routeNativeElement as HTMLElement;
  }

  it('shows the Mock URL of the workflow of the tab, inside the tab', async () => {
    const page = await open('listThenReadFirst');

    expect((page.querySelector('.workflow-mock-url input') as HTMLInputElement | null)?.value)
      .toEqual(document.location.origin + '/arazzo/API+Pastry+scenarios/1.0.0/listThenReadFirst');
    const block = page.querySelector('app-workflow-mock-url');
    expect(block?.previousElementSibling?.classList).toContain('workflow-tabs');
    expect(block?.nextElementSibling?.classList).toContain('workflow-body');
  });
});
