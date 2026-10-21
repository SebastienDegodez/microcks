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
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { BsModalService } from 'ngx-bootstrap/modal';
import { HighlightAuto, HighlightJS } from 'ngx-highlightjs';

import { WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { RequestResponsePair } from '../../../models/service.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { routes } from '../../../app.routes';
import { WorkflowRunDialogComponent } from '../workflow-run-dialog/workflow-run.dialog';
import { POLLING_INTERVAL, WorkflowRunPageComponent } from './workflow-run.page';

const MOCKS = { sourceName: 'pastryApi', serviceId: 'svc-1', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0',
  baseUrl: '/rest/API+Pastry+-+2.0/2.0.0' };
const MICROCKS = 'http://localhost:8080';
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
        operation: { sourceName: 'pastryApi', operationId: 'GetPastries', method: 'GET', path: '/pastry' },
        testCaseId: 'run-2-0', requestUrl: MICROCKS + '/rest/API+Pastry+-+2.0/2.0.0/pastry?size=S',
        parameters: [{ name: 'size', in: 'query', value: 'S' }], outputOrigins: { first: '$response.body#/0/name' } }),
      step(1, 'readFirst', 'FAILED', { statusCode: 400, elapsedTime: 5,
        criteria: [{ condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 400 }], held: false }],
        testCaseId: 'run-2-1', requestUrl: MICROCKS + '/rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum',
        parameters: [{ name: 'name', in: 'path', value: 'Baba Rhum', expression: '$steps.list.outputs.first' }],
        outputOrigins: {} }),
      step(2, 'reprice', 'NOT_RUN', { elapsedTime: 0,
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' } })
    ]
  };
}

describe('WorkflowRunPageComponent', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;
  let runs: jasmine.SpyObj<ArazzoRunService>;
  let modals: jasmine.SpyObj<BsModalService>;
  /** The request and response of each step, by testCaseId. */
  let exchanges: Record<string, RequestResponsePair[]>;
  /** The parameters of the route of the page, the run it shows. */
  let params: BehaviorSubject<ParamMap>;

  beforeEach(() => {
    exchanges = {};
  });

  function exchange(name: string, status: string, content: string | undefined,
                    requestContent?: string): RequestResponsePair[] {
    return [{ type: 'reqRespPair',
      request: { name, content: requestContent, headers: [] } as unknown as RequestResponsePair['request'],
      response: { name, status, content, mediaType: 'text/plain', headers: [] } as unknown as RequestResponsePair['response'] }];
  }

  function open(...answers: (WorkflowResult | Error)[]): void {
    params = new BehaviorSubject<ParamMap>(convertToParamMap({ runId: 'run-1' }));
    runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['getRun', 'getExchanges']);
    runs.getRun.and.returnValues(...answers.map(answer => answer instanceof Error
      ? throwError(() => answer) : of(answer)));
    runs.getExchanges.and.callFake((runId: string, testCaseId: string) => of(exchanges[testCaseId] ?? []));
    modals = jasmine.createSpyObj<BsModalService>('BsModalService', ['show']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
        { provide: ArazzoRunService, useValue: runs },
        { provide: BsModalService, useValue: modals },
        // The bodies are shown as given to the highlighting, which is left out of these tests.
        { provide: HighlightJS, useValue: { highlightAuto: () => new Promise(() => undefined) } }
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
      'Schema validation Off',
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

  function toggle(stepId: string): void {
    (stepElement(stepId).querySelector('.workflow-run-step-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function body(stepId: string): HTMLElement | null {
    return stepElement(stepId).querySelector('.workflow-run-step-body');
  }

  /** The text given to the highlighting of a body, under the element of the given class in a step. */
  function highlighted(stepId: string, selector: string): string[] {
    return fixture.debugElement.queryAll(By.css('[data-step-id="' + stepId + '"] ' + selector))
      .flatMap(section => section.queryAll(By.directive(HighlightAuto)))
      .map(element => element.injector.get(HighlightAuto).code() ?? '');
  }

  it('expands the failing step, the steps that passed being expanded on demand', fakeAsync(() => {
    open(failedRun());
    tick();
    fixture.detectChanges();

    expect(body('readFirst')).not.toBeNull();
    expect(body('list')).toBeNull();
    expect(stepElement('list').querySelector('.workflow-run-step-toggle')?.getAttribute('aria-expanded')).toEqual('false');

    toggle('list');
    expect(body('list')).not.toBeNull();
    toggle('list');
    expect(body('list')).toBeNull();
    toggle('readFirst');
    expect(body('readFirst')).toBeNull();
  }));

  it('opens another run with its failing step expanded and the others not', fakeAsync(() => {
    open(failedRun(), failedRun());
    tick();
    fixture.detectChanges();
    toggle('list');
    toggle('readFirst');

    params.next(convertToParamMap({ runId: 'run-3' }));
    tick();
    fixture.detectChanges();

    expect(runs.getRun).toHaveBeenCalledWith('run-3');
    expect(body('list')).toBeNull();
    expect(body('readFirst')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('shows the request URL, the response status and the response body of the failing step', fakeAsync(() => {
    exchanges['run-2-1'] = exchange('readFirst', '400', 'The response /name=Baba Rhum does not exist!');
    open(failedRun());
    tick();
    fixture.detectChanges();

    expect(runs.getExchanges).toHaveBeenCalledWith('run-2', 'run-2-1');
    expect(texts('.workflow-run-request-url', stepElement('readFirst')))
      .toEqual(['GET /rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum']);
    expect(stepElement('readFirst').querySelector('.workflow-run-request-url')?.getAttribute('title'))
      .toEqual(MICROCKS + '/rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum');
    expect(texts('.workflow-run-response .workflow-run-exchange-property', stepElement('readFirst')))
      .toEqual(['Status 400', 'Body']);
    expect(highlighted('readFirst', '.workflow-run-response'))
      .toEqual(['The response /name=Baba Rhum does not exist!']);
  }));

  it('shows the body a step sent, and says when a response has no body', fakeAsync(() => {
    const run = passedRun();
    run.steps[1] = { ...run.steps[1], testCaseId: 'run-1-1',
      requestUrl: MICROCKS + '/rest/API+Pastry+-+2.0/2.0.0/pastry/Eclair%20Cafe' };
    exchanges['run-1-1'] = exchange('reprice', '200', undefined, '{"price":2.6}');
    open(run);
    tick();
    fixture.detectChanges();

    toggle('reprice');

    expect(highlighted('reprice', '.workflow-run-request')).toEqual(['{"price":2.6}']);
    expect(texts('.workflow-run-response .workflow-run-exchange-property', stepElement('reprice')))
      .toEqual(['Status 200', 'Body Empty']);
  }));

  it('still shows what the run recorded of a step whose exchange cannot be read', fakeAsync(() => {
    open(failedRun());
    runs.getExchanges.and.returnValue(throwError(() => new Error('500')));
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-request-url', stepElement('readFirst')))
      .toEqual(['GET /rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum']);
    expect(texts('.workflow-run-response .workflow-run-exchange-property', stepElement('readFirst')))
      .toEqual(['Status 400', 'Body Empty']);
  }));

  it('reads the exchange of a step once while the run is followed', fakeAsync(() => {
    const inProgress = failedRun();
    inProgress.status = 'IN_PROGRESS';
    open(inProgress, failedRun());
    tick();
    fixture.detectChanges();
    tick(POLLING_INTERVAL);
    fixture.detectChanges();

    expect(runs.getRun).toHaveBeenCalledTimes(2);
    expect(runs.getExchanges.calls.allArgs()).toEqual([['run-2', 'run-2-1']]);
    discardPeriodicTasks();
  }));

  it('says when a step received no response', fakeAsync(() => {
    const run = failedRun();
    run.steps[1] = { ...run.steps[1], statusCode: undefined, criteria: [],
      message: 'No response: java.net.ConnectException' };
    open(run);
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-request-url', stepElement('readFirst')))
      .toEqual(['GET /rest/API+Pastry+-+2.0/2.0.0/pastry/Baba%20Rhum']);
    expect(texts('.workflow-run-response .workflow-run-no-response', stepElement('readFirst')))
      .toEqual(['No response']);
    expect(texts('.workflow-run-response .workflow-run-exchange-property', stepElement('readFirst'))).toEqual([]);
  }));

  it('shows each parameter of the failing step with its value and the expression it came from', fakeAsync(() => {
    const run = failedRun();
    run.steps[1].parameters!.push({ name: 'Accept', in: 'header', value: 'application/json' });
    open(run);
    tick();
    fixture.detectChanges();

    expect(Array.from(stepElement('readFirst').querySelectorAll('.workflow-run-parameter'))
      .map(row => texts('td', row).join(' | '))).toEqual([
      'name path | Baba Rhum | $steps.list.outputs.first',
      'Accept header | application/json | Constant'
    ]);
  }));

  it('shows each output of a step with the expression it came from', fakeAsync(() => {
    open(failedRun());
    tick();
    fixture.detectChanges();

    toggle('list');

    expect(texts('.workflow-run-step-output', stepElement('list')))
      .toEqual(['first = "Baba Rhum" from $response.body#/0/name']);
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

  it('tells that the responses were validated against their schema, and why a non-conformant one failed its step',
    fakeAsync(() => {
      const run = passedRun();
      run.status = 'FAILURE';
      run.validateSchema = true;
      run.steps[1] = { ...run.steps[1], status: 'FAILED', outputs: {},
        criteria: [{ condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 200 }], held: true }],
        message: '/price does not match the Pastry schema: string found, number expected' };
      open(run);
      tick();
      fixture.detectChanges();

      expect(texts('.workflow-run-property')[3]).toEqual('Schema validation On');
      expect(texts('.workflow-run-failure')).toEqual(['Step 2, reprice, failed: /price does not match the Pastry '
        + 'schema: string found, number expected. The workflow stopped there and produced no outputs.']);
      expect(texts('.workflow-run-step-message', stepElement('reprice')))
        .toEqual(['/price does not match the Pastry schema: string found, number expected']);
    }));

  it('says the run is not found when it cannot be read', fakeAsync(() => {
    open(new Error('404'));
    tick();
    fixture.detectChanges();

    expect(texts('.workflow-run-not-found')).toEqual(['This run does not exist.']);
  }));
});
