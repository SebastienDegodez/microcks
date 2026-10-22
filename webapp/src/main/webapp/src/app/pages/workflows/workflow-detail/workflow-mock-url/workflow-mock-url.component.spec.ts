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

import { ArazzoWorkflowDetail, ArazzoWorkflowExample, ArazzoWorkflowInput } from '../../../../models/arazzo-workflow.model';
import { WorkflowMockUrlComponent } from './workflow-mock-url.component';

/** The workflow readThenReprice of API Pastry scenarios 1.0.0, with the given inputs and recorded examples. */
function readThenReprice(inputs: ArazzoWorkflowInput[], examples?: ArazzoWorkflowExample[]): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1', title: 'API Pastry scenarios', version: '1.0.0', arazzoVersion: '1.0.1',
    importDate: Date.now(), workflowIds: ['readThenReprice'], sources: [], workflowId: 'readThenReprice',
    inputs, steps: [], outputs: {}, dataPassings: [], examples,
    status: { workflowId: 'readThenReprice', runnable: true, reasons: [] }
  };
}

function example(name: string, inputs: Record<string, unknown>): ArazzoWorkflowExample {
  return { workflowId: 'readThenReprice', name, inputs, outputs: {}, steps: [] };
}

const PASTRY_INPUTS: ArazzoWorkflowInput[] = [
  { name: 'pastry', type: 'string', usedBy: [], required: true },
  { name: 'newPrice', type: 'number', usedBy: [], required: true }
];

/** S27, AC-01: the tab of a workflow shows its Mock URL, and a curl posting its inputs to it. */
describe('WorkflowMockUrlComponent', () => {
  const mockUrl = document.location.origin + '/arazzo/API+Pastry+scenarios/1.0.0/readThenReprice';
  let fixture: ComponentFixture<WorkflowMockUrlComponent>;
  let page: HTMLElement;

  function show(workflow: ArazzoWorkflowDetail): void {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(WorkflowMockUrlComponent);
    fixture.componentRef.setInput('workflow', workflow);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  }

  function curl(): string {
    return page.querySelector('.workflow-mock-url-curl')?.textContent ?? '';
  }

  it('shows the Mock URL of the workflow, the title encoded like the API mock URLs', () => {
    show(readThenReprice(PASTRY_INPUTS));

    expect((page.querySelector('.workflow-mock-url input') as HTMLInputElement).value).toEqual(mockUrl);
  });

  it('gives a curl posting the inputs of the first recorded example', () => {
    show(readThenReprice(PASTRY_INPUTS, [
      example('eclair', { pastry: 'Eclair Cafe', newPrice: 2.6 }),
      example('millefeuille', { pastry: 'Millefeuille', newPrice: 4.1 })
    ]));

    expect(curl()).toEqual('curl -X POST \'' + mockUrl + '\' \\\n'
      + '  -H \'Content-Type: application/json\' \\\n'
      + '  -d \'{"pastry":"Eclair Cafe","newPrice":2.6}\'');
  });

  it('gives a curl with a placeholder typed from the input schema for each input, without recorded example', () => {
    show(readThenReprice([
      ...PASTRY_INPUTS,
      { name: 'quantity', type: 'integer', usedBy: [] },
      { name: 'express', type: 'boolean', usedBy: [] },
      { name: 'options', type: 'object', usedBy: [] },
      { name: 'tags', type: 'array', usedBy: [] },
      { name: 'note', usedBy: [] }
    ], []));

    expect(curl()).toContain('-d \'{"pastry":"<pastry>","newPrice":0,"quantity":0,"express":false,"options":{},'
      + '"tags":[],"note":"<note>"}\'');
  });

  it('posts an empty object for a workflow without inputs', () => {
    show(readThenReprice([]));

    expect(curl()).toContain('-d \'{}\'');
  });

  it('escapes the quotes of the inputs for the shell', () => {
    show(readThenReprice(PASTRY_INPUTS, [example('baba', { pastry: 'Baba d\'Yvette', newPrice: 3 })]));

    expect(curl()).toContain('-d \'{"pastry":"Baba d\'\\\'\'Yvette","newPrice":3}\'');
  });

  it('copies the Mock URL or the curl to the clipboard and tells it', () => {
    show(readThenReprice(PASTRY_INPUTS, [example('eclair', { pastry: 'Eclair Cafe', newPrice: 2.6 })]));
    const copied: string[] = [];
    spyOn(document, 'execCommand').and.callFake(() => {
      copied.push((document.activeElement as HTMLTextAreaElement).value);
      return true;
    });
    const buttons = page.querySelectorAll('.workflow-mock-url-copy');

    (buttons[0] as HTMLButtonElement).click();
    (buttons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(copied).toEqual([mockUrl, curl()]);
    expect(Array.from(page.querySelectorAll('.toast-pf')).map(toast => (toast.textContent ?? '').replace(/\s+/g, ' ')))
      .toEqual([jasmine.stringContaining('The Mock URL of readThenReprice has been copied to clipboard'),
        jasmine.stringContaining('The curl of readThenReprice has been copied to clipboard')]);
    expect(Array.from(buttons).map(button => button.getAttribute('aria-label')))
      .toEqual(['Copy the Mock URL of readThenReprice', 'Copy the curl of readThenReprice']);
  });
});
