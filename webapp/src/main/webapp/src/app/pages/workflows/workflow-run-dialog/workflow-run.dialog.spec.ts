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
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { BsModalRef } from 'ngx-bootstrap/modal';

import { ArazzoWorkflowDetail } from '../../../models/arazzo-workflow.model';
import { WorkflowResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { WorkflowRunDialogComponent } from './workflow-run.dialog';

/** A workflow of API Pastry scenarios, as GET /api/arazzo/documents/doc-1/workflows/{workflowId} answers it. */
function workflow(workflowId: string, inputs: ArazzoWorkflowDetail['inputs'], runnable = true): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1',
    title: 'API Pastry scenarios',
    version: '1.0.0',
    arazzoVersion: '1.0.1',
    importDate: Date.now(),
    workflowIds: ['readThenReprice', 'listThenReadFirst', 'deletePastry'],
    sources: [{ link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
      serviceId: 'svc-1', operations: 3, usedOperations: 3 }],
    workflowId,
    inputs,
    steps: [
      { stepId: 'first', operation: { sourceName: 'pastryApi', operationId: 'GetPastries' }, parameters: [],
        successCriteria: [], outputs: {} },
      { stepId: 'second', operation: { sourceName: 'pastryApi', operationId: 'GetPastryByName' }, parameters: [],
        successCriteria: [], outputs: {} }
    ],
    outputs: {},
    dataPassings: [],
    status: { workflowId, runnable,
      reasons: runnable ? [] : ['Operation DeletePastry not found in API Pastry - 2.0 2.0.0'] }
  };
}

const WORKFLOWS: Record<string, ArazzoWorkflowDetail> = {
  readThenReprice: workflow('readThenReprice', [
    { name: 'pastry', type: 'string', usedBy: [{ stepId: 'readPastry', place: 'path', target: 'name' }] },
    { name: 'newPrice', type: 'number', usedBy: [{ stepId: 'reprice', place: 'body', target: '/price' },
        { stepId: 'reprice', place: 'criterion' }] }
  ]),
  listThenReadFirst: workflow('listThenReadFirst', []),
  deletePastry: workflow('deletePastry', [], false)
};

describe('WorkflowRunDialogComponent', () => {
  let fixture: ComponentFixture<WorkflowRunDialogComponent>;
  let modalRef: jasmine.SpyObj<BsModalRef>;
  let runs: jasmine.SpyObj<ArazzoRunService>;
  let router: Router;

  function open(workflowId = 'readThenReprice'): void {
    modalRef = jasmine.createSpyObj<BsModalRef>('BsModalRef', ['hide']);
    runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['launchRun']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunDialogComponent],
      providers: [
        provideRouter([]),
        { provide: BsModalRef, useValue: modalRef },
        { provide: ArazzoRunService, useValue: runs },
        { provide: ArazzoWorkflowService, useValue: {
          getWorkflow: (documentId: string, id: string) => of(WORKFLOWS[id]) } }
      ]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(WorkflowRunDialogComponent);
    fixture.componentInstance.documentId = 'doc-1';
    fixture.componentInstance.workflowIds = ['readThenReprice', 'listThenReadFirst', 'deletePastry'];
    fixture.componentInstance.workflowId = workflowId;
    fixture.detectChanges();
  }

  function dialog(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(selector: string): string[] {
    return Array.from(dialog().querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function select(workflowId: string): void {
    const workflows = dialog().querySelector('#workflow-run-workflow') as HTMLSelectElement;
    workflows.value = workflowId;
    workflows.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = dialog().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function runButton(): HTMLButtonElement {
    return dialog().querySelector('.workflow-run-launch') as HTMLButtonElement;
  }

  it('offers the workflows of the document with their steps, the one chosen being selected', async () => {
    open();
    await fixture.whenStable();

    expect(texts('.modal-title')).toEqual(['Run workflow']);
    expect(texts('#workflow-run-workflow option'))
      .toEqual(['readThenReprice · 2 steps', 'listThenReadFirst · 2 steps', 'deletePastry · 2 steps · not runnable']);
    expect((dialog().querySelector('#workflow-run-workflow') as HTMLSelectElement).value).toEqual('readThenReprice');
  });

  it('runs against the Microcks mocks, running against implementations being available soon', () => {
    open();

    const targets = Array.from(dialog().querySelectorAll('.workflow-run-target input')) as HTMLInputElement[];
    expect(targets.map(target => target.checked)).toEqual([true, false]);
    expect(targets.map(target => target.disabled)).toEqual([false, true]);
    expect(texts('.workflow-run-target-title')).toEqual(['Microcks mocks', 'Implementations']);
    expect(texts('.workflow-run-target code')).toEqual(['/rest/API+Pastry+-+2.0/2.0.0']);
    expect(dialog().querySelectorAll('.workflow-run-target')[1].getAttribute('title')).toEqual('Available soon');
  });

  it('asks for each input with its type and where the workflow uses it', () => {
    open();

    expect(texts('.workflow-run-input-name')).toEqual(['pastry', 'newPrice']);
    expect(Array.from(dialog().querySelectorAll('.workflow-run-input input'))
      .map(input => (input as HTMLInputElement).type)).toEqual(['text', 'number']);
    expect(texts('.workflow-run-input-use'))
      .toEqual(['Path parameter name of readPastry', 'Body /price of reprice, and its success criterion']);
  });

  it('says when the workflow declares no input', () => {
    open();

    select('listThenReadFirst');

    expect(texts('.workflow-run-input-name')).toEqual([]);
    expect(texts('.workflow-run-no-input')).toEqual(['This workflow declares no input.']);
    expect(texts('.workflow-run-summary')).toEqual(['listThenReadFirst against Microcks mocks']);
  });

  it('keeps schema validation available soon, and a timeout of 10 seconds per step', async () => {
    open();
    await fixture.whenStable();

    const validation = dialog().querySelector('.workflow-run-validation input') as HTMLInputElement;
    expect(validation.disabled).toBeTrue();
    expect(validation.checked).toBeFalse();
    expect(dialog().querySelector('.workflow-run-validation')?.getAttribute('title')).toEqual('Available soon');
    expect((dialog().querySelector('#workflow-run-timeout') as HTMLInputElement).value).toEqual('10000');
  });

  it('runs the workflow with its inputs and timeout, then opens the run', async () => {
    open();
    runs.launchRun.and.returnValue(of({ id: 'run-1' } as WorkflowResult));
    await fixture.whenStable();

    type('#workflow-run-input-pastry', 'Eclair Cafe');
    type('#workflow-run-input-newPrice', '2.6');
    type('#workflow-run-timeout', '5000');
    expect(texts('.workflow-run-summary')).toEqual(['readThenReprice against Microcks mocks']);
    runButton().click();

    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', { pastry: 'Eclair Cafe', newPrice: 2.6 },
      5000);
    expect(modalRef.hide).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/workflows/runs', 'run-1']);
  });

  it('leaves out the inputs left empty', async () => {
    open();
    runs.launchRun.and.returnValue(of({ id: 'run-1' } as WorkflowResult));
    await fixture.whenStable();

    type('#workflow-run-input-pastry', 'Eclair Cafe');
    runButton().click();

    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', { pastry: 'Eclair Cafe' }, 10000);
  });

  it('does not run a workflow that cannot run, and tells why', () => {
    open('deletePastry');

    expect(runButton().disabled).toBeTrue();
    expect(texts('.workflow-run-not-runnable'))
      .toEqual(['Not runnable: Operation DeletePastry not found in API Pastry - 2.0 2.0.0']);
  });

  it('tells why Microcks refused the run, and stays open', () => {
    open();
    runs.launchRun.and.returnValue(throwError(() => ({ error: 'Workflow readThenReprice cannot run: no API' })));

    runButton().click();
    fixture.detectChanges();

    expect(texts('.workflow-run-error')).toEqual(['Workflow readThenReprice cannot run: no API']);
    expect(modalRef.hide).not.toHaveBeenCalled();
    expect(runButton().disabled).toBeFalse();
  });

  it('closes without running', () => {
    open();

    (dialog().querySelector('.workflow-run-cancel') as HTMLButtonElement).click();

    expect(modalRef.hide).toHaveBeenCalled();
    expect(runs.launchRun).not.toHaveBeenCalled();
  });
});
