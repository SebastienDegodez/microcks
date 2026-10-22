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
import { of } from 'rxjs';

import { BsModalRef } from 'ngx-bootstrap/modal';

import { ArazzoSourceDescription, ArazzoWorkflowDetail } from '../../../models/arazzo-workflow.model';
import { WorkflowResult } from '../../../models/arazzo-run.model';
import { Secret } from '../../../models/secret.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { SecretsService } from '../../../services/secrets.service';
import { WorkflowRunDialogComponent } from './workflow-run.dialog';

function source(sourceName: string, apiName: string | undefined, apiVersion: string | undefined):
    ArazzoSourceDescription {
  return { link: { sourceName, apiName, apiVersion, linked: apiName !== undefined }, serviceId: 'svc-' + sourceName,
    operations: 1, usedOperations: 1 };
}

/** A workflow, as GET /api/arazzo/documents/doc-1/workflows/{workflowId} answers it. */
function workflow(workflowId: string, sources: ArazzoSourceDescription[]): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1', title: 'Order fulfilment', version: '1.0.0', arazzoVersion: '1.0.1', importDate: Date.now(),
    workflowIds: [workflowId], sources, workflowId, inputs: [],
    steps: [{ stepId: 'getCustomer', operation: { sourceName: 'customerApi', operationId: 'GetCustomer' },
      parameters: [], successCriteria: [], outputs: {} }],
    outputs: {}, dataPassings: [], status: { workflowId, runnable: true, reasons: [] }
  };
}

const WORKFLOWS: Record<string, ArazzoWorkflowDetail> = {
  readThenReprice: workflow('readThenReprice', [source('pastryApi', 'API Pastry - 2.0', '2.0.0')]),
  placeOrder: workflow('placeOrder', [source('customerApi', 'Customer API', '1.0.0'),
    source('orderApi', 'Order API', '1.0.0'), source('paymentApi', undefined, undefined)])
};

/** The secrets the user may read, as GET /api/secrets answers them: without their sensitive values. */
const SECRETS: Secret[] = [
  { id: 'secret-1', name: 'pastry-staging-token', description: 'Token of the staging implementation' },
  { id: 'secret-2', name: 'orders-basic', description: 'Basic authentication of the orders service' }
];

describe('WorkflowRunDialogComponent against implementations', () => {
  let fixture: ComponentFixture<WorkflowRunDialogComponent>;
  let runs: jasmine.SpyObj<ArazzoRunService>;
  let secrets: jasmine.SpyObj<SecretsService>;

  function open(workflowId: string): void {
    runs = jasmine.createSpyObj<ArazzoRunService>('ArazzoRunService', ['launchRun']);
    runs.launchRun.and.returnValue(of({ id: 'run-1' } as WorkflowResult));
    secrets = jasmine.createSpyObj<SecretsService>('SecretsService', ['getSecrets']);
    secrets.getSecrets.and.returnValue(of(SECRETS));
    TestBed.configureTestingModule({
      imports: [WorkflowRunDialogComponent],
      providers: [
        provideRouter([]),
        { provide: BsModalRef, useValue: jasmine.createSpyObj<BsModalRef>('BsModalRef', ['hide']) },
        { provide: ArazzoRunService, useValue: runs },
        { provide: SecretsService, useValue: secrets },
        { provide: ArazzoWorkflowService, useValue: { getWorkflow: (documentId: string, id: string) => of(WORKFLOWS[id]) } }
      ]
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(WorkflowRunDialogComponent);
    fixture.componentInstance.documentId = 'doc-1';
    fixture.componentInstance.workflowIds = [workflowId];
    fixture.componentInstance.workflowId = workflowId;
    fixture.detectChanges();
  }

  function dialog(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(selector: string): string[] {
    return Array.from(dialog().querySelectorAll(selector)).map(node => (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  }

  function target(value: 'MOCKS' | 'IMPLEMENTATIONS'): void {
    const radio = dialog().querySelector('.workflow-run-target input[value="' + value + '"]') as HTMLInputElement;
    radio.click();
    fixture.detectChanges();
  }

  async function type(selector: string, value: string): Promise<void> {
    const input = dialog().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function chooseSecret(secretName: string): Promise<void> {
    const select = dialog().querySelector('#workflow-run-secret') as HTMLSelectElement;
    select.value = Array.from(select.options).find(option => option.text.trim() === secretName)!.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function runButton(): HTMLButtonElement {
    return dialog().querySelector('.workflow-run-launch') as HTMLButtonElement;
  }

  it('offers to run against implementations, asking a base URL for each linked source', async () => {
    open('placeOrder');
    await fixture.whenStable();

    const implementations = dialog().querySelector('.workflow-run-target input[value="IMPLEMENTATIONS"]') as HTMLInputElement;
    expect(implementations.disabled).toBeFalse();
    expect(dialog().querySelector('.workflow-run-target-disabled')).toBeNull();
    expect(dialog().querySelector('.workflow-run-implementations')).toBeNull();

    target('IMPLEMENTATIONS');

    expect(texts('.workflow-run-target-selected .workflow-run-target-title')).toEqual(['Implementations']);
    expect(texts('.workflow-run-base-url-label')).toEqual(['customerApi Customer API 1.0.0', 'orderApi Order API 1.0.0']);
    expect(Array.from(dialog().querySelectorAll('.workflow-run-base-url input'))
      .map(input => (input as HTMLInputElement).id)).toEqual(['workflow-run-base-url-customerApi', 'workflow-run-base-url-orderApi']);
    expect(texts('.workflow-run-summary')).toEqual(['placeOrder against implementations']);
  });

  it('runs each source against its own base URL', async () => {
    open('placeOrder');
    await fixture.whenStable();
    target('IMPLEMENTATIONS');

    await type('#workflow-run-base-url-customerApi', ' https://customers.staging.example ');
    expect(runButton().disabled).toBeTrue();
    await type('#workflow-run-base-url-orderApi', 'https://orders.staging.example');
    runButton().click();

    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'placeOrder', {}, 10000, {
      baseUrls: { customerApi: 'https://customers.staging.example', orderApi: 'https://orders.staging.example' }
    }, true);
  });

  it('offers the secrets the user may read, and runs with the one chosen', async () => {
    open('readThenReprice');
    await fixture.whenStable();
    expect(secrets.getSecrets).not.toHaveBeenCalled();

    target('IMPLEMENTATIONS');
    await fixture.whenStable();

    expect(texts('#workflow-run-secret option')).toEqual(['No secret', 'pastry-staging-token', 'orders-basic']);
    await type('#workflow-run-base-url-pastryApi', 'http://localhost:8080');
    await chooseSecret('pastry-staging-token');
    runButton().click();

    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', {}, 10000,
      { baseUrls: { pastryApi: 'http://localhost:8080' }, secretName: 'pastry-staging-token' }, true);
  });

  it('runs against the mocks again once the API developer goes back to them', async () => {
    open('readThenReprice');
    await fixture.whenStable();
    target('IMPLEMENTATIONS');
    await type('#workflow-run-base-url-pastryApi', 'http://localhost:8080');

    target('MOCKS');
    target('IMPLEMENTATIONS');
    target('MOCKS');

    expect(dialog().querySelector('.workflow-run-implementations')).toBeNull();
    expect(texts('.workflow-run-summary')).toEqual(['readThenReprice against Microcks mocks']);
    expect(secrets.getSecrets).toHaveBeenCalledTimes(1);
    runButton().click();
    expect(runs.launchRun).toHaveBeenCalledWith('doc-1', 'readThenReprice', {}, 10000, undefined, true);
  });
});
