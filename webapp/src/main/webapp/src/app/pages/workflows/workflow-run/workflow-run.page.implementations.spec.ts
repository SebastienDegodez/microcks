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

import { WorkflowResult, WorkflowSourceTarget } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { WorkflowRunPageComponent } from './workflow-run.page';

/** A run against implementations, as GET /api/arazzo/runs/run-1 answers it. */
function implementationRun(sources: WorkflowSourceTarget[], extra: Partial<WorkflowResult> = {}): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target: 'IMPLEMENTATIONS', sources, inputs: {}, outputs: {},
    status: 'SUCCESS', startedDate: Date.now() - 3 * 60 * 1000, elapsedTime: 13, timeout: 10000, steps: [],
    ...extra
  };
}

const PASTRY_IMPLEMENTATION: WorkflowSourceTarget = { sourceName: 'pastryApi', serviceId: 'svc-1',
  apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', baseUrl: 'http://localhost:8080' };

describe('WorkflowRunPageComponent of a run against implementations', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;

  function open(run: WorkflowResult): void {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(run) } },
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) }
      ]
    });
    fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  function texts(selector: string): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector))
      .map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  it('shows the implementation it targeted and the secret its calls carried', fakeAsync(() => {
    open(implementationRun([PASTRY_IMPLEMENTATION],
      { secretRef: { secretId: 'secret-1', name: 'pastry-staging-token' } }));

    expect(texts('.workflow-run-subtitle')).toEqual(['Ran 3 minutes ago against implementations · 13 ms']);
    expect(texts('.workflow-run-property')).toEqual([
      'Workflow readThenReprice in API Pastry scenarios 1.0.0',
      'Target Implementations · pastryApi → http://localhost:8080',
      'Secret pastry-staging-token',
      'Inputs None declared',
      'Schema validation Off',
      'Outputs None declared'
    ]);
    expect(texts('.workflow-run-target-source code')).toEqual(['pastryApi', 'http://localhost:8080']);
  }));

  it('shows the base URL each source was called at', fakeAsync(() => {
    open(implementationRun([
      { sourceName: 'customerApi', serviceId: 'svc-2', apiName: 'Customer API', apiVersion: '1.0.0',
        baseUrl: 'https://customers.staging.example' },
      { sourceName: 'orderApi', serviceId: 'svc-3', apiName: 'Order API', apiVersion: '1.0.0',
        baseUrl: 'https://orders.staging.example' }
    ], { workflowId: 'placeOrder' }));

    expect(texts('.workflow-run-property')[1]).toEqual('Target Implementations · customerApi → '
      + 'https://customers.staging.example · orderApi → https://orders.staging.example');
    expect(texts('.workflow-run-property dt')).not.toContain('Secret');
  }));
});
