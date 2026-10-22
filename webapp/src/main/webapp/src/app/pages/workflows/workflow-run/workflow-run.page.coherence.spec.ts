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
import { EventEmitter } from '@angular/core';
import { of, throwError } from 'rxjs';

import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { HighlightJS } from 'ngx-highlightjs';

import { WorkflowMissingExample, WorkflowParameterValue, WorkflowResult, WorkflowStepResult }
  from '../../../models/arazzo-run.model';
import { Exchange, Service } from '../../../models/service.model';
import { AICopilotService } from '../../../services/aicopilot.service';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { IAuthenticationService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { ServicesService } from '../../../services/services.service';
import { GenerateSamplesDialogComponent } from '../../services/{serviceId}/_components/generate-samples.dialog';
import { WorkflowRunPageComponent } from './workflow-run.page';

const MOCKS = { sourceName: 'pastryApi', serviceId: 'svc-1', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0',
  baseUrl: '/rest/API+Pastry+-+2.0/2.0.0' };
const GET_PASTRY_BY_NAME = { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET',
  path: '/pastry/{name}' };
const STATUS_WAS_400 = [{ condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 400 }],
  held: false }];
const API_PASTRY = { id: 'svc-1', name: 'API Pastry - 2.0', version: '2.0.0', type: 'REST' } as Service;

function step(index: number, stepId: string, status: WorkflowStepResult['status'],
              extra: Partial<WorkflowStepResult> = {}): WorkflowStepResult {
  return { index, stepId, operation: GET_PASTRY_BY_NAME, status, elapsedTime: 5, criteria: [], outputs: {}, ...extra };
}

/** The example the mocks of API Pastry lack for readFirst: GetPastryByName has none for Baba Rhum. */
function babaRhumIsMissing(parameters: WorkflowParameterValue[] = [{ name: 'name', in: 'path', value: 'Baba Rhum',
  expression: '$steps.list.outputs.first' }]): WorkflowMissingExample {
  return { stepIndex: 1, stepId: 'readFirst', serviceId: 'svc-1', operationId: 'GetPastryByName',
    operationName: 'GET /pastry/{name}', parameters };
}

/** The run of listThenReadFirst that failed at readFirst against the mocks. */
function failedRun(missingExample?: WorkflowMissingExample): WorkflowResult {
  return {
    id: 'run-2', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'listThenReadFirst', target: 'MOCKS', sources: [MOCKS], inputs: {}, outputs: {},
    status: 'FAILURE', startedDate: Date.now() - 3 * 60 * 1000, elapsedTime: 13, timeout: 10000,
    steps: [
      step(0, 'list', 'PASSED', { statusCode: 200, outputs: { first: 'Baba Rhum' },
        operation: { sourceName: 'pastryApi', operationId: 'GetPastries', method: 'GET', path: '/pastry' } }),
      step(1, 'readFirst', 'FAILED', { statusCode: 400, criteria: STATUS_WAS_400,
        parameters: [{ name: 'name', in: 'path', value: 'Baba Rhum', expression: '$steps.list.outputs.first' }] })
    ],
    missingExample
  };
}

/** The run of readThenReprice that passed against the mocks. */
function passedRun(): WorkflowResult {
  return {
    id: 'run-1', documentId: 'doc-1', documentTitle: 'API Pastry scenarios', documentVersion: '1.0.0',
    workflowId: 'readThenReprice', target: 'MOCKS', sources: [MOCKS],
    inputs: { pastry: 'Eclair Cafe', newPrice: 2.6 }, outputs: { before: 2.5, after: 2.6 },
    status: 'SUCCESS', startedDate: Date.now() - 3 * 60 * 1000, elapsedTime: 13, timeout: 10000,
    steps: [step(0, 'readPastry', 'PASSED', { statusCode: 200 })]
  };
}

describe('WorkflowRunPageComponent, when the mocks do not form a coherent scenario', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;
  let modals: jasmine.SpyObj<BsModalService>;
  let services: jasmine.SpyObj<ServicesService>;
  let copilot: jasmine.SpyObj<AICopilotService>;
  /** The examples the AI Copilot dialog saves. */
  let saveSamplesAction: EventEmitter<Exchange[]>;
  let copilotEnabled: boolean;
  let manager: boolean;

  beforeEach(() => {
    copilotEnabled = false;
    manager = true;
  });

  function open(run: WorkflowResult): void {
    const runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['getRun', 'getExchanges']);
    runs.getRun.and.returnValue(of(run));
    runs.getExchanges.and.returnValue(of([]));
    saveSamplesAction = new EventEmitter<Exchange[]>();
    modals = jasmine.createSpyObj<BsModalService>('BsModalService', ['show']);
    modals.show.and.returnValue({ content: { saveSamplesAction }, setClass: () => undefined } as unknown as BsModalRef);
    services = jasmine.createSpyObj<ServicesService>('ServicesService', ['getService']);
    services.getService.and.returnValue(of(API_PASTRY));
    copilot = jasmine.createSpyObj<AICopilotService>('AICopilotService', ['addSamplesSuggestions']);
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: run.id })) } },
        { provide: ArazzoRunService, useValue: runs },
        { provide: BsModalService, useValue: modals },
        { provide: ServicesService, useValue: services },
        { provide: AICopilotService, useValue: copilot },
        { provide: ConfigService, useValue: { hasFeatureEnabled: (feature: string) => feature === 'ai-copilot' && copilotEnabled } },
        { provide: IAuthenticationService, useValue: { hasRole: (role: string) => role === 'manager' && manager } },
        { provide: HighlightJS, useValue: { highlightAuto: () => new Promise(() => undefined) } }
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

  function texts(selector: string, root: ParentNode = page()): string[] {
    return Array.from(root.querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function stepElement(stepId: string): HTMLElement {
    return page().querySelector('[data-step-id="' + stepId + '"]') as HTMLElement;
  }

  /** The links and buttons of the hint, in their order on the page. */
  function links(): HTMLElement[] {
    return Array.from(page().querySelectorAll<HTMLElement>('.workflow-run-coherence a, .workflow-run-coherence button'));
  }

  it('explains that GetPastryByName has no example for name = Baba Rhum, under the step that failed', fakeAsync(() => {
    open(failedRun(babaRhumIsMissing()));

    expect(texts('.workflow-run-coherence', stepElement('readFirst'))).toEqual([
      'The mocks do not form a coherent scenario. GetPastries returns “Baba Rhum”, but GetPastryByName has no example '
      + 'for name = Baba Rhum. Add that example to the OpenAPI document, or let the workflow send a value that has one. '
      + 'Open GetPastryByName'
    ]);
    expect(texts('.workflow-run-coherence code')).toEqual(['name']);
    expect(texts('.workflow-run-coherence', stepElement('list'))).toEqual([]);
  }));

  it('links to GET /pastry/{name} on the page of API Pastry - 2.0', fakeAsync(() => {
    open(failedRun(babaRhumIsMissing()));

    expect(links().map(link => link.textContent?.trim())).toEqual(['Open GetPastryByName']);
    expect(links()[0].getAttribute('href')).toEqual('/services/svc-1?operation=GET%20%2Fpastry%2F%7Bname%7D');
    expect(links()[0].getAttribute('title')).toEqual('GET /pastry/{name} on API Pastry - 2.0 2.0.0');
  }));

  it('shows no example hint for a run that passed', fakeAsync(() => {
    open(passedRun());

    expect(page().querySelector('.workflow-run-coherence')).toBeNull();
  }));

  it('shows no example hint for a failed run that misses no example, as a run against an implementation',
    fakeAsync(() => {
      open(failedRun());

      expect(texts('.workflow-run-failure').length).toEqual(1);
      expect(page().querySelector('.workflow-run-coherence')).toBeNull();
    }));

  it('says where each missing value came from: a step, an input, or none for a constant', fakeAsync(() => {
    open(failedRun(babaRhumIsMissing([
      { name: 'name', in: 'path', value: 'Baba Rhum', expression: '$inputs.pastry' },
      { name: 'lang', in: 'query', value: 'fr', expression: '$steps.list.outputs.lang' },
      { name: 'size', in: 'query', value: 'L', expression: '$steps.unknown.outputs.size' },
      { name: 'page', in: 'query', value: 2 }
    ])));

    expect(texts('.workflow-run-coherence-text')).toEqual([
      'The mocks do not form a coherent scenario. The input pastry is “Baba Rhum” and GetPastries returns “fr”, but '
      + 'GetPastryByName has no example for name = Baba Rhum, lang = fr, size = L and page = 2. Add that example '
      + 'to the OpenAPI document, or let the workflow send a value that has one.'
    ]);
  }));

  it('says only what the operation lacks when the values are constants', fakeAsync(() => {
    open(failedRun(babaRhumIsMissing([{ name: 'name', in: 'path', value: 'Baba Rhum' }])));

    expect(texts('.workflow-run-coherence-text')).toEqual([
      'The mocks do not form a coherent scenario. GetPastryByName has no example for name = Baba Rhum. Add that '
      + 'example to the OpenAPI document, or let the workflow send a value that has one.'
    ]);
  }));

  it('offers no AI Copilot when it is disabled, or to someone who is not a manager', fakeAsync(() => {
    copilotEnabled = true;
    manager = false;
    open(failedRun(babaRhumIsMissing()));

    expect(links().map(link => link.textContent?.trim())).toEqual(['Open GetPastryByName']);
  }));

  describe('with the AI Copilot enabled', () => {

    beforeEach(() => {
      copilotEnabled = true;
    });

    function generate(): void {
      links()[1].click();
      fixture.detectChanges();
    }

    it('offers to generate the example with the AI Copilot, in its samples dialog for GET /pastry/{name}',
      fakeAsync(() => {
        open(failedRun(babaRhumIsMissing()));

        expect(links().map(link => link.textContent?.trim()))
          .toEqual(['Open GetPastryByName', 'Generate the example with the AI Copilot']);
        generate();

        expect(services.getService).toHaveBeenCalledWith('svc-1');
        expect(modals.show).toHaveBeenCalledWith(GenerateSamplesDialogComponent, { initialState: {
          closeBtnName: 'Cancel', service: API_PASTRY, operationName: 'GET /pastry/{name}' } });
      }));

    it('adds the examples the AI Copilot generated to the operation and says so', fakeAsync(() => {
      const generated = [{ type: 'reqRespPair' }] as unknown as Exchange[];
      open(failedRun(babaRhumIsMissing()));
      copilot.addSamplesSuggestions.and.returnValue(of({}));
      generate();

      saveSamplesAction.emit(generated);
      fixture.detectChanges();

      expect(copilot.addSamplesSuggestions).toHaveBeenCalledWith(API_PASTRY, 'GET /pastry/{name}', generated);
      expect(texts('.workflow-run-coherence-outcome')).toEqual(['Examples have been added to GET /pastry/{name}.']);
    }));

    it('says when the examples the AI Copilot generated cannot be added', fakeAsync(() => {
      open(failedRun(babaRhumIsMissing()));
      copilot.addSamplesSuggestions.and.returnValue(throwError(() => new Error('Forbidden')));
      generate();

      saveSamplesAction.emit([]);
      fixture.detectChanges();

      expect(texts('.workflow-run-coherence-outcome')).toEqual(['Examples cannot be added (Forbidden).']);
    }));
  });
});
