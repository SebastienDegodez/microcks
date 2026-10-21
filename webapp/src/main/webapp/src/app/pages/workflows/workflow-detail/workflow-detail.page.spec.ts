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
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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
    arazzoVersion: '1.0.1',
    fileName: 'pastry.arazzo.yaml',
    importDate: Date.now() - 2 * 24 * 3600 * 1000,
    workflowIds: ['readThenReprice', 'listThenReadFirst'],
    sources: [{ link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
      serviceId: 'svc-1', operations: 3, usedOperations: 3 }],
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
  let harness: RouterTestingHarness;
  let page: HTMLElement;

  async function open(workflow: ArazzoWorkflowDetail | Error,
                      url = '/workflows/doc-1/readThenReprice'): Promise<void> {
    const service = {
      getWorkflow: jasmine.createSpy('getWorkflow')
        .and.returnValue(workflow instanceof Error ? throwError(() => workflow) : of(workflow))
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/:documentId/:workflowId', component: WorkflowDetailPageComponent }]),
        { provide: ArazzoWorkflowService, useValue: service }
      ]
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, WorkflowDetailPageComponent);
    page = harness.routeNativeElement as HTMLElement;
    expect(service.getWorkflow).toHaveBeenCalledWith('doc-1', 'readThenReprice');
  }

  /** Lets the router navigate and the page render what it navigated to. */
  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function currentUrl(): string {
    return TestBed.inject(Router).url;
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

  it('shows the title, version and Arazzo version of the document, and where and when it was imported', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-title')).toEqual(['API Pastry scenarios 1.0.0 ARAZZO 1.0.1']);
    expect(texts('.workflow-subtitle')).toEqual(['Imported 2 days ago from pastry.arazzo.yaml · 2 workflows']);
    expect(texts('.breadcrumb li')).toEqual(['Workflows', 'API Pastry scenarios - 1.0.0']);
  });

  it('shows each step with its operation, parameters, criteria and outputs', async () => {
    await open(readThenReprice());

    expect(texts('.workflow-step-title')).toEqual(['1 readPastry', '2 reprice']);
    expect(texts('.workflow-step-operation', step('readPastry'))).toEqual(['REST GET /pastry/{name} GetPastryByName']);
    expect(step('readPastry').querySelector('.workflow-step-operation a')?.getAttribute('href'))
      .toEqual('/services/svc-1');
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
    workflow.sources.push(
      { link: { sourceName: 'orderApi', apiName: 'Order API', apiVersion: '1.0.0', linked: false },
        reason: 'API Order API 1.0.0 not found', operations: 0, usedOperations: 0 },
      { link: { sourceName: 'customerApi', linked: false },
        reason: 'no API name and version for this source', operations: 0, usedOperations: 0 });
    await open(workflow);

    expect(texts('.workflow-source')).toEqual([
      'pastryApi REST API Pastry - 2.0 2.0.0 · 3 operations, 3 used by steps',
      'orderApi API Order API 1.0.0 not found',
      'customerApi no API name and version for this source'
    ]);
    expect(Array.from(page.querySelectorAll('.workflow-source a')).map(link => link.getAttribute('href')))
      .toEqual(['/services/svc-1']);
  });

  describe('view switch', () => {

    function switchButtons(): HTMLButtonElement[] {
      return Array.from(page.querySelectorAll('.workflow-view-switch button')) as HTMLButtonElement[];
    }

    function pressed(): string[] {
      return switchButtons().filter(button => button.getAttribute('aria-pressed') === 'true')
        .map(button => normalized(button.textContent));
    }

    it('shows the steps by default, with a switch to the diagram', async () => {
      await open(readThenReprice());

      expect(switchButtons().map(button => normalized(button.textContent))).toEqual(['Steps', 'Diagram']);
      expect(pressed()).toEqual(['Steps']);
      expect(page.querySelectorAll('.workflow-step').length).toEqual(2);
      expect(page.querySelector('.workflow-diagram')).toBeNull();
    });

    it('shows the diagram when the URL asks for it, and keeps that view on the tabs of the other workflows', async () => {
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      expect(pressed()).toEqual(['Diagram']);
      expect(page.querySelector('.workflow-diagram')).not.toBeNull();
      expect(page.querySelectorAll('.workflow-step').length).toEqual(0);
      expect(Array.from(page.querySelectorAll('.workflow-tabs a')).map(link => link.getAttribute('href'))).toEqual([
        '/workflows/doc-1/readThenReprice?view=diagram',
        '/workflows/doc-1/listThenReadFirst?view=diagram'
      ]);
    });

    it('switches to the diagram and back to the steps, keeping the choice in the URL', async () => {
      await open(readThenReprice());

      switchButtons()[1].click();
      await settle();

      expect(currentUrl()).toEqual('/workflows/doc-1/readThenReprice?view=diagram');
      expect(pressed()).toEqual(['Diagram']);
      expect(page.querySelector('.workflow-diagram')).not.toBeNull();

      switchButtons()[0].click();
      await settle();

      expect(currentUrl()).toEqual('/workflows/doc-1/readThenReprice');
      expect(pressed()).toEqual(['Steps']);
      expect(page.querySelector('.workflow-diagram')).toBeNull();
      expect(page.querySelectorAll('.workflow-step').length).toEqual(2);
    });
  });

  describe('diagram', () => {

    function diagramNode(id: string): HTMLElement {
      return page.querySelector('.diagram-node[data-node-id="' + id + '"]') as HTMLElement;
    }

    it('draws the inputs, each step in order with its operation and criteria, then the outputs', async () => {
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      expect(Array.from(page.querySelectorAll('.diagram-node')).map(each => each.getAttribute('data-node-id')))
        .toEqual(['inputs', 'step:readPastry', 'step:reprice', 'outputs']);
      expect(texts('.diagram-node')).toEqual([
        'Inputs pastry newPrice',
        '1 readPastry REST GET /pastry/{name} GetPastryByName '
          + '$statusCode == 200 && $response.body#/status == \'available\'',
        '2 reprice REST PATCH /pastry/{name} PatchPastry '
          + '$statusCode == 200 · $response.body#/price == $inputs.newPrice',
        'Outputs before ← $steps.readPastry.outputs.price after ← $steps.reprice.outputs.price'
      ]);
    });

    it('chains the inputs, the steps and the outputs with sequence edges', async () => {
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      expect(Array.from(page.querySelectorAll('.diagram-edge-sequence'))
        .map(edge => edge.getAttribute('data-from') + ' -> ' + edge.getAttribute('data-to'))).toEqual([
        'inputs -> step:readPastry',
        'step:readPastry -> step:reprice',
        'step:reprice -> outputs'
      ]);
    });

    it('labels the data edges with what flows from the inputs and from a step output', async () => {
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      expect(Array.from(page.querySelectorAll('.diagram-edge-data'))
        .map(edge => edge.getAttribute('data-from') + ' -> ' + edge.getAttribute('data-to'))).toEqual([
        'inputs -> step:readPastry',
        'inputs -> step:reprice',
        'step:readPastry -> step:reprice'
      ]);
      expect(texts('.diagram-data-label')).toEqual([
        '$inputs.pastry → path name',
        '$inputs.newPrice → body /price → criterion',
        'outputs.name → path name'
      ]);
    });

    it('shows a step whose operation is not found with its operationId alone and the reason as a problem', async () => {
      const workflow = readThenReprice();
      workflow.steps[0].operation = { sourceName: 'pastryApi', operationId: 'GetPastryByName',
        reason: 'no API name and version for this source' };
      await open(workflow, '/workflows/doc-1/readThenReprice?view=diagram');

      const unlinked = diagramNode('step:readPastry');
      expect(normalized(unlinked.textContent)).toEqual('1 readPastry GetPastryByName '
        + 'no API name and version for this source $statusCode == 200 && $response.body#/status == \'available\'');
      expect(texts('.workflow-problem', unlinked)).toEqual(['no API name and version for this source']);
      expect(unlinked.classList).toContain('diagram-node-problem');
      expect(unlinked.querySelector('.workflow-protocol-chip')).toBeNull();
      expect(diagramNode('step:reprice').classList).not.toContain('diagram-node-problem');
    });

    it('shows a workflow without input nor output', async () => {
      const workflow = readThenReprice();
      workflow.inputs = [];
      workflow.outputs = {};
      await open(workflow, '/workflows/doc-1/readThenReprice?view=diagram');

      expect(texts('.diagram-node[data-node-id="inputs"]')).toEqual(['Inputs No input']);
      expect(texts('.diagram-node[data-node-id="outputs"]')).toEqual(['Outputs No output']);
    });

    it('opens the step card of a step clicked in the diagram', async () => {
      const scrolled = spyOn(Element.prototype, 'scrollIntoView');
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      diagramNode('step:reprice').click();
      await settle();

      expect(currentUrl()).toEqual('/workflows/doc-1/readThenReprice');
      expect(page.querySelector('.workflow-diagram')).toBeNull();
      expect(scrolled).toHaveBeenCalledTimes(1);
      expect(scrolled.calls.mostRecent().object).toBe(step('reprice'));
    });

    it('opens the step card of a step chosen with the keyboard', async () => {
      const scrolled = spyOn(Element.prototype, 'scrollIntoView');
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      const node = diagramNode('step:readPastry');
      expect(node.getAttribute('tabindex')).toEqual('0');
      expect(node.getAttribute('role')).toEqual('button');
      node.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await settle();

      expect(currentUrl()).toEqual('/workflows/doc-1/readThenReprice');
      expect(scrolled.calls.mostRecent().object).toBe(step('readPastry'));
    });

    it('keeps the run controls disabled and shows no run result on the nodes', async () => {
      await open(readThenReprice(), '/workflows/doc-1/readThenReprice?view=diagram');

      const controls = Array.from(page.querySelectorAll('.workflow-run-controls button')) as HTMLButtonElement[];
      expect(controls.every(control => control.disabled)).toBeTrue();
      expect(page.querySelectorAll('.workflow-diagram [class*="status"]').length).toEqual(0);
    });
  });

  it('says the workflow is not found when it cannot be read', async () => {
    await open(new Error('404'));

    expect(texts('.workflow-not-found')).toEqual(['This workflow does not exist.']);
  });
});
