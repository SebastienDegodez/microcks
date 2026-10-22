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

import { WorkflowResult, WorkflowRunOrigin } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { WorkflowRunPageComponent } from './workflow-run.page';

/** A run of readThenReprice on the mocks, launched from the given origin. */
function readThenReprice(origin?: WorkflowRunOrigin): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target: 'MOCKS', sources: [], inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 },
    outputs: { before: 2.5, after: 2.6 }, status: 'SUCCESS', startedDate: Date.now() - 60 * 1000, elapsedTime: 13,
    timeout: 10000, number: 4, steps: [], origin
  };
}

/** S27, AC-05: the run page shows that a run was played through the Mock URL of its workflow. */
describe('WorkflowRunPageComponent origin of the run', () => {

  function open(run: WorkflowResult): HTMLElement {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(run) } },
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) }
      ]
    });
    const fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('marks a run played through the Mock URL of its workflow', fakeAsync(() => {
    const page = open(readThenReprice('MOCK_URL'));

    expect((page.querySelector('.workflow-run-subtitle .arazzo-run-origin')?.textContent ?? '').trim())
      .toEqual('Mock URL');
    expect(page.querySelector('.arazzo-run-origin')?.getAttribute('title'))
      .toEqual('Played by an application posting its inputs to the Mock URL of the workflow');
  }));

  it('does not mark a run launched from Microcks', fakeAsync(() => {
    expect(open(readThenReprice()).querySelector('.arazzo-run-origin')).toBeNull();
  }));
});
