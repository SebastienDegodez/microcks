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
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ArazzoWorkflowDetail } from '../../../models/arazzo-workflow.model';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { WorkflowDetailPageComponent } from './workflow-detail.page';

/** The workflow readThenReprice, as GET /api/arazzo/documents/{documentId}/workflows/readThenReprice answers it. */
function readThenReprice(): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1',
    title: 'API Pastry scenarios',
    version: '1.0.0',
    workflowIds: ['readThenReprice', 'listThenReadFirst'],
    sources: [{ sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true }],
    workflowId: 'readThenReprice',
    summary: 'Reads a pastry, then changes its price using the name returned by the first call.',
    inputs: [
      { name: 'pastry', usedBy: [{ stepId: 'readPastry', place: 'path', target: 'name' }] },
      { name: 'newPrice', usedBy: [{ stepId: 'reprice', place: 'body', target: '/price' },
          { stepId: 'reprice', place: 'criterion' }] }
    ],
    steps: [
      {
        stepId: 'readPastry',
        operation: { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET', path: '/pastry/{name}' },
        parameters: [
          { name: 'name', in: 'path', value: '$inputs.pastry' },
          { name: 'Accept', in: 'header', value: 'application/json' }
        ],
        successCriteria: [{ condition: '$statusCode == 200 && $response.body#/status == \'available\'', type: 'simple' }],
        outputs: { name: '$response.body#/name', price: '$response.body#/price' }
      },
      {
        stepId: 'reprice',
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' },
        parameters: [{ name: 'name', in: 'path', value: '$steps.readPastry.outputs.name' }],
        requestBody: { contentType: 'application/json', payload: '{\n  "price" : 0\n}',
          replacements: { '/price': '$inputs.newPrice' } },
        successCriteria: [
          { condition: '$statusCode == 200', type: 'simple' },
          { condition: '$response.body#/price == $inputs.newPrice', type: 'simple' }
        ],
        outputs: { price: '$response.body#/price' }
      }
    ],
    outputs: { before: '$steps.readPastry.outputs.price', after: '$steps.reprice.outputs.price' },
    dataPassings: [{ fromStepId: 'readPastry', outputName: 'name', to: { stepId: 'reprice', place: 'path', target: 'name' } }]
  };
}

describe('WorkflowDetailPageComponent', () => {
  let fixture: ComponentFixture<WorkflowDetailPageComponent>;
  let page: HTMLElement;

  async function open(workflow: ArazzoWorkflowDetail | Error): Promise<void> {
    const service = {
      getWorkflow: jasmine.createSpy('getWorkflow')
        .and.returnValue(workflow instanceof Error ? throwError(() => workflow) : of(workflow))
    };
    await TestBed.configureTestingModule({
      imports: [WorkflowDetailPageComponent],
      providers: [
        provideRouter([]),
        { provide: ArazzoWorkflowService, useValue: service },
        { provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ documentId: 'doc-1', workflowId: 'readThenReprice' })) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(WorkflowDetailPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
    expect(service.getWorkflow).toHaveBeenCalledWith('doc-1', 'readThenReprice');
  }

  function texts(selector: string, root: ParentNode = page): string[] {
    return Array.from(root.querySelectorAll(selector)).map(element => normalized(element.textContent));
  }

  function normalized(text: string | null): string {
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  function rows(selector: string): string[] {
    return Array.from(page.querySelectorAll(selector))
      .map(row => texts('td', row).join(' '));
  }

  function step(stepId: string): HTMLElement {
    return page.querySelector('[data-step-id="' + stepId + '"]') as HTMLElement;
  }

  it('shows each step with its operation, parameters, criteria and outputs', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-step-title')).toEqual(['1 readPastry', '2 reprice']);
    expect(texts('.workflow-step-operation', step('readPastry'))).toEqual(['GET /pastry/{name} GetPastryByName']);
    expect(texts('.workflow-step-parameter', step('readPastry')))
      .toEqual(['name path ← $inputs.pastry', 'Accept header = application/json']);
    expect(texts('.workflow-step-criterion', step('readPastry')))
      .toEqual(['$statusCode == 200 && $response.body#/status == \'available\'']);
    expect(texts('.workflow-step-output', step('readPastry')))
      .toEqual(['name ← $response.body#/name', 'price ← $response.body#/price']);
    expect(texts('.workflow-step-body-payload', step('reprice'))).toEqual(['{ "price" : 0 }']);
    expect(texts('.workflow-step-replacement', step('reprice'))).toEqual(['/price replaced by $inputs.newPrice']);
  });

  it('shows the operationId alone with the reason when the operation is not found', async () => {
    const workflow = readThenReprice();
    workflow.steps[0].operation = { sourceName: 'pastryApi', operationId: 'GetPastryByName',
      reason: 'no API name and version for this source' };
    await open(workflow);

    expect(texts('.workflow-step-operation', step('readPastry')))
      .toEqual(['GetPastryByName no API name and version for this source']);
  });

  it('states which step output becomes a parameter of a later step', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-data-passing'))
      .toEqual(['readPastry.outputs.name becomes the name path parameter of reprice']);
    expect(page.querySelector('.workflow-data-passing')?.nextElementSibling?.getAttribute('data-step-id'))
      .toEqual('reprice');
  });

  it('states which step output replaces a body part or is checked by a criterion', async () => {
    const workflow = readThenReprice();
    workflow.dataPassings = [
      { fromStepId: 'readPastry', outputName: 'price', to: { stepId: 'reprice', place: 'body', target: '/price' } },
      { fromStepId: 'readPastry', outputName: 'name', to: { stepId: 'reprice', place: 'criterion' } }
    ];
    await open(workflow);

    expect(texts('.workflow-data-passing')).toEqual([
      'readPastry.outputs.price replaces /price in the request body of reprice',
      'readPastry.outputs.name is checked by a success criterion of reprice'
    ]);
  });

  it('lists the inputs with the steps and places using them, and the workflow outputs with their expressions', async () => {
    const workflow = readThenReprice();
    workflow.inputs.push({ name: 'unused', usedBy: [] });
    await open(workflow);

    expect(rows('.workflow-input')).toEqual([
      'pastry readPastry · path name',
      'newPrice reprice · body /price, criterion',
      'unused Not used'
    ]);
    expect(texts('.workflow-output')).toEqual([
      'before ← $steps.readPastry.outputs.price',
      'after ← $steps.reprice.outputs.price'
    ]);
  });

  it('shows one tab per workflow of the document, without a run result', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-tabs li')).toEqual(['readThenReprice', 'listThenReadFirst']);
    expect(texts('.workflow-tabs li.active')).toEqual(['readThenReprice']);
    expect(Array.from(page.querySelectorAll('.workflow-tabs a')).map(link => link.getAttribute('href')))
      .toEqual(['/workflows/doc-1/readThenReprice', '/workflows/doc-1/listThenReadFirst']);
  });

  it('shows the run controls disabled, as available soon, and no link source control', async () => {
    await open(readThenReprice());

    const controls = Array.from(page.querySelectorAll('.workflow-run-controls button')) as HTMLButtonElement[];
    expect(controls.map(control => normalized(control.textContent))).toEqual(['Runs history', 'Run workflow']);
    expect(controls.every(control => control.disabled)).toBeTrue();
    expect(texts('.workflow-run-controls [title]').length).toEqual(2);
    expect(Array.from(page.querySelectorAll('.workflow-run-controls [title]')).map(e => e.getAttribute('title')))
      .toEqual(['Available soon', 'Available soon']);
    expect(normalized(page.textContent)).not.toContain('Change link');
    expect(normalized(page.textContent)).not.toContain('Link sources');
  });

  it('shows that the workflow has never run, with no recent run', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-recent-runs .workflow-empty')).toEqual(['Never run']);
  });

  it('shows the source descriptions with the API each one is linked to, or why it is not', async () => {
    const workflow = readThenReprice();
    workflow.sources.push({ sourceName: 'orderApi', apiName: 'Order API', apiVersion: '1.0.0', linked: false },
      { sourceName: 'customerApi', linked: false });
    await open(workflow);

    expect(texts('.workflow-source')).toEqual([
      'pastryApi API Pastry - 2.0 2.0.0',
      'orderApi Order API 1.0.0 not found in Microcks',
      'customerApi No API name and version for this source'
    ]);
  });

  it('says the workflow is not found when it cannot be read', async () => {
    await open(new Error('404'));

    expect(texts('.workflow-not-found')).toEqual(['This workflow does not exist.']);
  });
});
