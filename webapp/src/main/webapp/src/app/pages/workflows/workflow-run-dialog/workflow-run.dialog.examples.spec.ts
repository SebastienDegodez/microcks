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
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BsModalRef } from 'ngx-bootstrap/modal';

import { ArazzoWorkflowDetail, ArazzoWorkflowExample } from '../../../models/arazzo-workflow.model';
import { ArazzoExampleLaunch, WorkflowResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { SecretsService } from '../../../services/secrets.service';
import { WorkflowRunDialogComponent } from './workflow-run.dialog';

const ECLAIR_REPRICED: ArazzoWorkflowExample = {
  workflowId: 'readThenReprice', name: 'eclair-repriced', inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 },
  outputs: { before: 2.5, after: 2.6 }, steps: []
};

const MILLEFEUILLE_REPRICED: ArazzoWorkflowExample = {
  workflowId: 'readThenReprice', name: 'millefeuille-repriced', inputs: { pastry: 'Millefeuille', newPrice: 4.5 },
  outputs: {}, steps: []
};

const UNKNOWN_FIRST_PASTRY: ArazzoWorkflowExample = {
  workflowId: 'listThenReadFirst', name: 'unknown-first-pastry', inputs: {}, outputs: {},
  steps: [{ stepId: 'list', status: 200, outputs: { first: 'Baba Rhum' } }, { stepId: 'readFirst', status: 404, outputs: {} }],
  stopsAt: 'readFirst'
};

/** A workflow of API Pastry scenarios, as GET /api/arazzo/documents/doc-1/workflows/{workflowId} answers it. */
function workflow(workflowId: string, examples: ArazzoWorkflowExample[] | undefined): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1', title: 'API Pastry scenarios', version: '1.0.0', arazzoVersion: '1.0.1',
    importDate: Date.now(), workflowIds: ['readThenReprice', 'listThenReadFirst', 'readOnly'],
    sources: [{ link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
      serviceId: 'svc-1', operations: 3, usedOperations: 3 }],
    workflowId,
    inputs: workflowId === 'readThenReprice' ? [
      { name: 'pastry', usedBy: [], type: 'string', required: true },
      { name: 'newPrice', usedBy: [], type: 'number', required: true }
    ] : [],
    steps: [], outputs: {}, dataPassings: [], status: { workflowId, runnable: true, reasons: [] }, examples
  };
}

const WORKFLOWS: Record<string, ArazzoWorkflowDetail> = {
  readThenReprice: workflow('readThenReprice', [ECLAIR_REPRICED, MILLEFEUILLE_REPRICED]),
  listThenReadFirst: workflow('listThenReadFirst', [UNKNOWN_FIRST_PASTRY]),
  readOnly: workflow('readOnly', [])
};

/** The runs of Run all examples, as GET /api/arazzo/runs/{runId} answers them once they ended. */
const ENDED_RUNS: Record<string, Partial<WorkflowResult>> = {
  'run-7': { id: 'run-7', number: 7, status: 'SUCCESS',
    example: { name: 'eclair-repriced', outputs: {}, steps: [], verdict: 'MATCHES', unmetExpectations: [] } },
  'run-8': { id: 'run-8', number: 8, status: 'SUCCESS',
    example: { name: 'millefeuille-repriced', outputs: {}, steps: [], verdict: 'DOES_NOT_MATCH',
      unmetExpectations: ['Output after: expected 4.5 but was 4.4'] } }
};

describe('WorkflowRunDialogComponent with recorded examples', () => {
  let fixture: ComponentFixture<WorkflowRunDialogComponent>;
  let runs: jasmine.SpyObj<ArazzoRunService>;
  let modal: jasmine.SpyObj<BsModalRef>;
  let router: Router;

  function open(workflowId: string, exampleName?: string): void {
    runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['launchRun', 'launchExampleRuns', 'getRun']);
    runs.launchRun.and.returnValue(of({ id: 'run-1' } as WorkflowResult));
    runs.getRun.and.callFake((runId: string) => of(ENDED_RUNS[runId] as WorkflowResult));
    modal = jasmine.createSpyObj<BsModalRef>('BsModalRef', ['hide']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunDialogComponent],
      providers: [
        provideRouter([]),
        { provide: BsModalRef, useValue: modal },
        { provide: ArazzoRunService, useValue: runs },
        { provide: SecretsService, useValue: jasmine.createSpyObj<SecretsService>('SecretsService', ['getSecrets']) },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: (documentId: string, id: string) => of(WORKFLOWS[id]) } }
      ]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(WorkflowRunDialogComponent);
    fixture.componentInstance.documentId = 'doc-1';
    fixture.componentInstance.workflowIds = ['readThenReprice', 'listThenReadFirst', 'readOnly'];
    fixture.componentInstance.workflowId = workflowId;
    fixture.componentInstance.exampleName = exampleName;
    fixture.detectChanges();
  }

  function dialog(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(selector: string): string[] {
    return Array.from(dialog().querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function input(name: string): HTMLInputElement {
    return dialog().querySelector('#workflow-run-input-' + name) as HTMLInputElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function pick(exampleLabel: string): Promise<void> {
    const select = dialog().querySelector('#workflow-run-example') as HTMLSelectElement;
    select.value = Array.from(select.options).find(option => option.text.trim() === exampleLabel)!.value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  async function type(name: string, value: string): Promise<void> {
    input(name).value = value;
    input(name).dispatchEvent(new Event('input'));
    await settle();
  }

  function runButton(): HTMLButtonElement {
    return dialog().querySelector('.workflow-run-launch') as HTMLButtonElement;
  }

  it('offers the recorded examples of the workflow, none picked', async () => {
    open('readThenReprice');
    await settle();

    expect(texts('label[for="workflow-run-example"]')).toEqual(['Example']);
    expect(texts('#workflow-run-example option')).toEqual(['None, I enter the inputs', 'eclair-repriced',
      'millefeuille-repriced']);
    expect(input('pastry').value).toEqual('');
    expect(dialog().querySelector('.workflow-run-expected')).toBeNull();
    expect(texts('.workflow-run-all-examples')).toEqual(['Run all 2 examples']);
  });

  it('fills the inputs with the picked example and shows the outputs it expects', async () => {
    open('readThenReprice');
    await settle();

    await pick('eclair-repriced');

    expect(input('pastry').value).toEqual('Eclair Cafe');
    expect(input('newPrice').value).toEqual('2.6');
    expect(texts('.workflow-run-expected-title')).toEqual(['Expected by eclair-repriced']);
    expect(texts('.workflow-run-expected-output')).toEqual(['before = 2.5', 'after = 2.6']);
    expect(texts('.workflow-run-expected-stop')).toEqual(['Runs to its end']);
    expect(texts('.workflow-run-summary')).toEqual(['readThenReprice · example eclair-repriced against Microcks mocks']);

    runButton().click();

    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', { pastry: 'Eclair Cafe', newPrice: 2.6 },
      10000, undefined, true, 'eclair-repriced');
  });

  it('shows the statuses and outputs an example expects of the steps, and where the workflow stops', async () => {
    open('listThenReadFirst');
    await settle();

    await pick('unknown-first-pastry');

    expect(texts('.workflow-run-expected-step')).toEqual(['list 200 · first = "Baba Rhum"', 'readFirst 404']);
    expect(texts('.workflow-run-expected-stop')).toEqual(['Stops at readFirst']);
    expect(dialog().querySelector('.workflow-run-expected-output')).toBeNull();
  });

  it('detaches the run from the example once an input is edited', async () => {
    open('readThenReprice');
    await settle();
    await pick('eclair-repriced');

    await type('newPrice', '2.7');

    expect(texts('.workflow-run-detached')).toEqual(
      ['You changed an input: this run plays no example, so its expected outputs will not be checked.']);
    expect(dialog().querySelector('.workflow-run-expected')).toBeNull();
    expect(texts('.workflow-run-summary')).toEqual(['readThenReprice against Microcks mocks']);
    runButton().click();
    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', { pastry: 'Eclair Cafe', newPrice: 2.7 },
      10000, undefined, true);
  });

  it('empties the inputs when going back to no example', async () => {
    open('readThenReprice');
    await settle();
    await pick('eclair-repriced');

    await pick('None, I enter the inputs');

    expect(input('pastry').value).toEqual('');
    expect(dialog().querySelector('.workflow-run-expected')).toBeNull();
    expect(dialog().querySelector('.workflow-run-detached')).toBeNull();
  });

  it('forgets the example when another workflow is selected', async () => {
    open('readThenReprice');
    await settle();
    await pick('eclair-repriced');

    const select = dialog().querySelector('#workflow-run-workflow') as HTMLSelectElement;
    select.value = 'listThenReadFirst';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect((dialog().querySelector('#workflow-run-example') as HTMLSelectElement).value).toEqual('');
    expect(texts('.workflow-run-all-examples')).toEqual(['Run all 1 example']);
  });

  it('opens on the example a run played, to run it again', async () => {
    open('readThenReprice', 'eclair-repriced');
    await settle();

    expect(input('pastry').value).toEqual('Eclair Cafe');
    expect(texts('.workflow-run-expected-title')).toEqual(['Expected by eclair-repriced']);
  });

  it('offers neither the Example list nor Run all examples for a workflow without recorded example', async () => {
    open('readOnly');
    await settle();

    expect(dialog().querySelector('#workflow-run-example')).toBeNull();
    expect(dialog().querySelector('.workflow-run-all-examples')).toBeNull();
  });

  it('runs all the examples and reports the verdict of each, or why it was refused', fakeAsync(() => {
    open('readThenReprice');
    tick();
    fixture.detectChanges();
    runs.launchExampleRuns.and.returnValue(of([
      { example: 'eclair-repriced', runId: 'run-7', number: 7 },
      { example: 'millefeuille-repriced', runId: 'run-8', number: 8 },
      { example: 'eclair-without-price', refusal: 'Missing input: newPrice' }
    ] as ArazzoExampleLaunch[]));

    (dialog().querySelector('.workflow-run-all-examples') as HTMLButtonElement).click();
    tick();
    fixture.detectChanges();

    expect(runs.launchExampleRuns).toHaveBeenCalledWith('doc-1', 'readThenReprice', 10000, undefined, true);
    expect(texts('.workflow-run-example-result')).toEqual([
      'eclair-repriced Run #7 Matches the example',
      'millefeuille-repriced Run #8 Does not match the example: Output after: expected 4.5 but was 4.4',
      'eclair-without-price Refused: Missing input: newPrice'
    ]);
    expect(modal.hide).not.toHaveBeenCalled();

    (dialog().querySelector('.workflow-run-history') as HTMLButtonElement).click();
    expect(modal.hide).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/workflows/documents', 'doc-1', 'runs'],
      { queryParams: { workflow: 'readThenReprice' } });
  }));
});
