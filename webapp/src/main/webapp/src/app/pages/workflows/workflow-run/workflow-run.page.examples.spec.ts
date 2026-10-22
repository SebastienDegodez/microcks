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

import { WorkflowExampleCheck, WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { WorkflowRunDialogComponent } from '../workflow-run-dialog/workflow-run.dialog';
import { WorkflowRunPageComponent } from './workflow-run.page';

const PASTRY_MOCKS = { sourceName: 'pastryApi', serviceId: 'svc-1', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0',
  baseUrl: '/rest/API+Pastry+-+2.0/2.0.0' };

function step(index: number, stepId: string, status: WorkflowStepResult['status'], statusCode?: number,
              outputs: Record<string, unknown> = {}): WorkflowStepResult {
  return { index, stepId, operation: { sourceName: 'pastryApi', operationId: stepId, method: 'GET', path: '/pastry' },
    status, statusCode, elapsedTime: 5, criteria: [], outputs };
}

/** A run of readThenReprice playing eclair-repriced on the mocks, as GET /api/arazzo/runs/run-1 answers it. */
function eclairRepriced(after: number, example: Partial<WorkflowExampleCheck>): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target: 'MOCKS', sources: [PASTRY_MOCKS],
    inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 }, outputs: { before: 2.5, after }, status: 'SUCCESS',
    startedDate: Date.now() - 60 * 1000, elapsedTime: 13, timeout: 10000, number: 12,
    steps: [step(0, 'readPastry', 'PASSED', 200), step(1, 'reprice', 'PASSED', 200)],
    example: { name: 'eclair-repriced', outputs: { before: 2.5, after: 2.6 }, steps: [], unmetExpectations: [],
      ...example }
  };
}

/** A run of listThenReadFirst playing unknown-first-pastry: readFirst answered with the given status. */
function unknownFirstPastry(readFirstStatus: number, example: Partial<WorkflowExampleCheck>): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'listThenReadFirst', target: 'MOCKS', sources: [PASTRY_MOCKS], inputs: {}, outputs: {},
    status: 'FAILURE', startedDate: Date.now() - 60 * 1000, elapsedTime: 9, timeout: 10000, number: 13,
    steps: [step(0, 'list', 'PASSED', 200, { first: 'Baba Rhum' }), step(1, 'readFirst', 'FAILED', readFirstStatus)],
    example: { name: 'unknown-first-pastry', outputs: {},
      steps: [{ stepId: 'list', status: 200, outputs: { first: 'Baba Rhum' } }, { stepId: 'readFirst', status: 404, outputs: {} }],
      stopsAt: 'readFirst', unmetExpectations: [], ...example }
  };
}

describe('WorkflowRunPageComponent of a run playing a recorded example', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;
  let modals: jasmine.SpyObj<BsModalService>;

  function open(run: WorkflowResult): void {
    modals = jasmine.createSpyObj<BsModalService>('BsModalService', ['show']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(run) } },
        { provide: BsModalService, useValue: modals }
      ]
    });
    fixture = TestBed.createComponent(WorkflowRunPageComponent);
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(selector: string): string[] {
    return Array.from(page().querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function property(label: string): string | undefined {
    return texts('.workflow-run-property').find(text => text.startsWith(label + ' '));
  }

  it('says the run matches the example it played, next to its own result', fakeAsync(() => {
    open(eclairRepriced(2.6, { verdict: 'MATCHES' }));

    expect(texts('.workflow-run-title')).toEqual(['Run #12 · readThenReprice passed']);
    expect(texts('.workflow-run-example-verdict')).toEqual(['Matches the example eclair-repriced: every expectation holds.']);
    expect(page().querySelector('.workflow-run-example-verdict.workflow-run-example-matches')).not.toBeNull();
    expect(property('Example')).toEqual('Example eclair-repriced · Matches');
    expect(property('Expected outputs')).toEqual('Expected outputs before expected 2.5, got 2.5 after expected 2.6, got 2.6');
    expect(property('Expected end')).toEqual('Expected end Runs to its end');
  }));

  it('says the run does not match the example, with each unmet expectation, and shows the output it got', fakeAsync(() => {
    open(eclairRepriced(2.7, { verdict: 'DOES_NOT_MATCH', unmetExpectations: ['Output after: expected 2.6 but was 2.7'] }));

    expect(texts('.workflow-run-title')).toEqual(['Run #12 · readThenReprice passed']);
    expect(texts('.workflow-run-example-verdict p')).toEqual(['Does not match the example eclair-repriced:']);
    expect(texts('.workflow-run-example-verdict li')).toEqual(['Output after: expected 2.6 but was 2.7']);
    expect(property('Example')).toEqual('Example eclair-repriced · Does not match');
    expect(texts('.workflow-run-expected-output.workflow-run-expected-unmet')).toEqual(['after expected 2.6, got 2.7']);
  }));

  it('says a workflow failing as its example expects matches the example', fakeAsync(() => {
    open(unknownFirstPastry(404, { verdict: 'MATCHES' }));

    expect(texts('.workflow-run-title')).toEqual(['Run #13 · listThenReadFirst failed']);
    expect(page().querySelector('.workflow-run-failure')).not.toBeNull();
    expect(texts('.workflow-run-example-verdict')).toEqual(
      ['Matches the example unknown-first-pastry: every expectation holds.']);
    expect(property('Expected steps')).toEqual('Expected steps list 200 · first = "Baba Rhum" readFirst 404');
    expect(property('Expected end')).toEqual('Expected end Stops at readFirst');
    expect(property('Expected outputs')).toBeUndefined();
  }));

  it('says when readFirst answers another status than the example expects', fakeAsync(() => {
    open(unknownFirstPastry(400, { verdict: 'DOES_NOT_MATCH',
      unmetExpectations: ['Step readFirst: expecting 404 but got 400'] }));

    expect(texts('.workflow-run-example-verdict li')).toEqual(['Step readFirst: expecting 404 but got 400']);
  }));

  it('waits for the end of the run to judge it on its example', fakeAsync(() => {
    open({ ...eclairRepriced(2.6, {}), status: 'IN_PROGRESS', steps: [] });

    expect(page().querySelector('.workflow-run-example-verdict')).toBeNull();
    expect(property('Example')).toEqual('Example eclair-repriced · Judged once the run ends');
  }));

  it('shows nothing of examples for a run that played none', fakeAsync(() => {
    open({ ...eclairRepriced(2.6, {}), example: undefined });

    expect(page().querySelector('.workflow-run-example-verdict')).toBeNull();
    expect(property('Example')).toBeUndefined();
    expect(property('Expected end')).toBeUndefined();
  }));

  it('runs the example again from the run', fakeAsync(() => {
    open(eclairRepriced(2.6, { verdict: 'MATCHES' }));

    (page().querySelector('.workflow-run-again') as HTMLButtonElement).click();

    expect(modals.show).toHaveBeenCalledWith(WorkflowRunDialogComponent, jasmine.objectContaining({
      initialState: { documentId: 'doc-1', workflowIds: ['readThenReprice'], workflowId: 'readThenReprice',
        exampleName: 'eclair-repriced' }
    }));
  }));
});
