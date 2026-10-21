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
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';

import { WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { routes } from '../../../app.routes';
import { WorkflowRunDialogComponent } from '../workflow-run-dialog/workflow-run.dialog';
import { POLLING_INTERVAL, WorkflowRunPageComponent } from './workflow-run.page';

const MOCKS = { sourceName: 'pastryApi', serviceId: 'svc-1', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0',
  baseUrl: '/rest/API+Pastry+-+2.0/2.0.0' };
const GET_PASTRY_BY_NAME = { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET',
  path: '/pastry/{name}' };

function step(index: number, stepId: string, status: WorkflowStepResult['status'],
              extra: Partial<WorkflowStepResult> = {}): WorkflowStepResult {
  return { index, stepId, operation: GET_PASTRY_BY_NAME, status, elapsedTime: 8, criteria: [], outputs: {}, ...extra };
}

/** The run of readThenReprice that passed against the mocks, as GET /api/arazzo/runs/run-1 answers it. */
function passedRun(): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target: 'MOCKS', sources: [MOCKS],
    inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 }, outputs: { before: 2.5, after: 2.6 },
    status: 'SUCCESS', startedDate: Date.now() - 3 * 60 * 1000, elapsedTime: 13, timeout: 10000,
    steps: [
      step(0, 'readPastry', 'PASSED', { statusCode: 200, outputs: { name: 'Eclair Cafe', price: 2.5 },
        criteria: [{ condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 200 }], held: true }] }),
      step(1, 'reprice', 'PASSED', { statusCode: 200, elapsedTime: 5, outputs: { price: 2.6 },
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' } })
    ]
  };
}

/** The run of listThenReadFirst that failed at readFirst against the mocks. */
function failedRun(): WorkflowResult {
  return {
    id: 'run-2', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'listThenReadFirst', target: 'MOCKS', sources: [MOCKS], inputs: {}, outputs: {},
    status: 'FAILURE', startedDate: Date.now() - 3 * 60 * 1000, elapsedTime: 13, timeout: 10000,
    steps: [
      step(0, 'list', 'PASSED', { statusCode: 200, outputs: { first: 'Baba Rhum' },
        operation: { sourceName: 'pastryApi', operationId: 'GetPastries', method: 'GET', path: '/pastry' } }),
      step(1, 'readFirst', 'FAILED', { statusCode: 400, elapsedTime: 5,
        criteria: [{ condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 400 }], held: false }] }),
      step(2, 'reprice', 'NOT_RUN', { elapsedTime: 0,
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' } })
    ]
  };
}

describe('WorkflowRunPageComponent', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;
  let runs: jasmine.SpyObj<ArazzoRunService>;
  let modals: jasmine.SpyObj<BsModalService>;

  function open(...answers: (WorkflowResult | Error)[]): void {
    runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['getRun']);
    runs.getRun.and.returnValues(...answers.map(answer => answer instanceof Error
      ? throwError(() => answer) : of(answer)));
    modals = jasmine.createSpyObj<BsModalService>('BsModalService', ['show']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: runs },
        { provide: BsModalService, useValue: modals }
      ]
    });
    fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(selector: string, root: ParentNode = page()): string[] {
    return Array.from(root.querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function stepElement(stepId: string): HTMLElement {
    return page().querySelector('[data-step-id="' + stepId + '"]') as HTMLElement;
  }

  it('is the page of the /workflows/runs/:runId route, before the workflow pages', () => {
    const paths = routes.map(route => route.path);
    expect(routes.find(route => route.path === 'workflows/runs/:runId')?.component).toBe(WorkflowRunPageComponent);
    expect(paths.indexOf('workflows/runs/:runId')).toBeLessThan(paths.indexOf('workflows/:documentId/:workflowId'));
  });

  it('shows a run that passed with its workflow, target, inputs and outputs', fakeAsync(() => {
    open(passedRun());
    tick();
    fixture.detectChanges();

    expect(runs.getRun).toHaveBeenCalledWith('run-1');
    expect(texts('.breadcrumb li')).toEqual(['Workflows', 'API Pastry scenarios - 1.0.0', 'Runs', 'Run']);
    expect(texts('.workflow-run-title')).toEqual(['Run · readThenReprice passed']);
    expect(texts('.workflow-run-subtitle')).toEqual(['Ran 3 minutes ago against Microcks mocks · 13 ms']);
    expect(page().querySelector('.workflow-run-status-icon')?.className).toContain('pficon-ok');
    expect(texts('.workflow-run-property')).toEqual([
      'Workflow readThenReprice in API Pastry scenarios 1.0.0',
      'Target Microcks mocks · /rest/API+Pastry+-+2.0/2.0.0',
      'Inputs pastry = "Eclair Cafe" newPrice = 2.6',
      'Outputs before = 2.5 after = 2.6'
    ]);
    expect(page().querySelector('.workflow-run-property a')?.getAttribute('href'))
      .toEqual('/workflows/doc-1/readThenReprice');
    expect(texts('.workflow-run-failure')).toEqual([]);
  }));

  it('shows the steps in the order they were executed, with their status code and time', fakeAsync(() => {
    open(passedRun());
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-step-heading')).toEqual([
      '1 · readPastry REST GET /pastry/{name} GetPastryByName 200 · 8 ms',
      '2 · reprice REST PATCH /pastry/{name} PatchPastry 200 · 5 ms'
    ]);
    expect(texts('.workflow-run-step-output', stepElement('readPastry')))
      .toEqual(['name = "Eclair Cafe"', 'price = 2.5']);
  }));

  it('tells where a failed run stopped, and which criterion did not hold', fakeAsync(() => {
    open(failedRun());
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-title')).toEqual(['Run · listThenReadFirst failed']);
    expect(page().querySelector('.workflow-run-status-icon')?.className).toContain('pficon-error-circle-o');
    expect(texts('.workflow-run-failure')).toEqual(['Step 2, readFirst, failed. Success criterion $statusCode == 200 '
      + 'did not hold: the response status was 400. The workflow stopped there and produced no outputs.']);
    expect(texts('.workflow-run-property')[2]).toEqual('Inputs None declared');
    expect(Array.from(stepElement('readFirst').querySelectorAll('.workflow-run-criterion'))
      .map(row => texts('td', row).join(' | '))).toEqual(['$statusCode == 200 | $statusCode = 400 | Failed']);
    expect(texts('.workflow-run-step-output', stepElement('list'))).toEqual(['first = "Baba Rhum"']);
    expect(stepElement('readFirst').classList).toContain('workflow-run-step-failed');
  }));

  it('keeps the place of a step that did not run after the failure', fakeAsync(() => {
    open(failedRun());
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-step-heading', stepElement('reprice')))
      .toEqual(['3 · reprice REST PATCH /pastry/{name} PatchPastry Not run']);
    expect(stepElement('reprice').querySelector('.workflow-run-step-body')).toBeNull();
  }));

  it('tells why a step failed when no criterion tells it', fakeAsync(() => {
    const run = failedRun();
    run.steps[1] = step(1, 'readFirst', 'FAILED', { message: 'No response: java.net.ConnectException' });
    open(run);
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-failure'))
      .toEqual(['Step 2, readFirst, failed: No response: java.net.ConnectException. The workflow stopped there and '
        + 'produced no outputs.']);
    expect(texts('.workflow-run-step-message', stepElement('readFirst')))
      .toEqual(['No response: java.net.ConnectException']);
  }));

  it('tells why a run failed when no step tells it', fakeAsync(() => {
    const run = failedRun();
    run.steps = [];
    run.message = 'The Arazzo minion at http://localhost:8082 did not receive the run';
    open(run);
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-failure'))
      .toEqual(['The run failed: The Arazzo minion at http://localhost:8082 did not receive the run']);
  }));

  it('collapses and expands a step', fakeAsync(() => {
    open(passedRun());
    tick();
    fixture.detectChanges();

    (stepElement('readPastry').querySelector('.workflow-run-step-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(stepElement('readPastry').querySelector('.workflow-run-step-body')).toBeNull();

    (stepElement('readPastry').querySelector('.workflow-run-step-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(stepElement('readPastry').querySelector('.workflow-run-step-body')).not.toBeNull();
  }));

  it('shows a run in progress, then its final result without reload', fakeAsync(() => {
    const inProgress = passedRun();
    inProgress.status = 'IN_PROGRESS';
    inProgress.outputs = undefined;
    inProgress.steps = inProgress.steps.slice(0, 1);
    open(inProgress, passedRun());
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-title')).toEqual(['Run · readThenReprice in progress']);
    expect(page().querySelector('.workflow-run-status-icon')?.className).toContain('spinner');
    expect(texts('.workflow-run-step-heading').length).toEqual(1);

    tick(POLLING_INTERVAL);
    fixture.detectChanges();

    expect(texts('.workflow-run-title')).toEqual(['Run · readThenReprice passed']);
    expect(texts('.workflow-run-step-heading').length).toEqual(2);
    tick(3 * POLLING_INTERVAL);
    expect(runs.getRun).toHaveBeenCalledTimes(2);
    discardPeriodicTasks();
  }));

  it('runs the same workflow again from the run', fakeAsync(() => {
    open(passedRun());
    tick();
    fixture.detectChanges();

    (page().querySelector('.workflow-run-again') as HTMLButtonElement).click();

    expect(modals.show).toHaveBeenCalledWith(WorkflowRunDialogComponent, jasmine.objectContaining({
      initialState: { documentId: 'doc-1', workflowIds: ['readThenReprice'], workflowId: 'readThenReprice' }
    }));
  }));

  it('names the run by its number and links the Runs breadcrumb to the runs history of its document', fakeAsync(() => {
    open({ ...failedRun(), number: 6 });
    tick();
    fixture.detectChanges();

    expect(texts('.breadcrumb li')).toEqual(['Workflows', 'API Pastry scenarios - 1.0.0', 'Runs', 'Run #6']);
    expect(Array.from(page().querySelectorAll('.breadcrumb a')).map(link => link.getAttribute('href')))
      .toEqual(['/workflows', '/workflows/doc-1/listThenReadFirst', '/workflows/documents/doc-1/runs']);
    expect(page().querySelectorAll('.breadcrumb [title="Available soon"]').length).toEqual(0);
    expect(texts('.workflow-run-title')).toEqual(['Run #6 · listThenReadFirst failed']);
  }));

  it('says the run is not found when it cannot be read', fakeAsync(() => {
    open(new Error('404'));
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-not-found')).toEqual(['This run does not exist.']);
  }));
});
