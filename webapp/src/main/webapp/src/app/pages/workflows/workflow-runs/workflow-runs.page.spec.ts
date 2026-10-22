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
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { routes } from '../../../app.routes';
import { ArazzoDocumentSummary } from '../../../models/arazzo-document.model';
import { ServiceType } from '../../../models/service.model';
import { ArazzoDocumentsService } from '../../../services/arazzo-documents.service';
import { ArazzoRunHistoryService } from '../../../services/arazzo-run-history.service';
import { FakeRunHistory, HOUR, pastryRuns } from '../../../../test-data/arazzo-run-history';
import { WorkflowRunsPageComponent } from './workflow-runs.page';

const PASTRY_SCENARIOS: ArazzoDocumentSummary = {
  id: 'pastry-doc',
  title: 'API Pastry scenarios',
  version: '1.0.0',
  arazzoVersion: '1.0.1',
  fileName: 'pastry.arazzo.yaml',
  importDate: Date.now() - 48 * HOUR,
  sources: [{
    link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
    apiId: 'pastry-api', apiType: ServiceType.REST
  }],
  workflows: [
    { status: { workflowId: 'readThenReprice', runnable: true, reasons: [] }, description: null, stepCount: 2,
      lastResult: 'FAILED' },
    { status: { workflowId: 'listThenReadFirst', runnable: true, reasons: [] }, description: null, stepCount: 2,
      lastResult: 'FAILED' }
  ]
};

describe('WorkflowRunsPageComponent', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let history: FakeRunHistory;

  async function open(url = '/workflows/documents/pastry-doc/runs', runs = pastryRuns()): Promise<void> {
    history = new FakeRunHistory(runs);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/documents/:documentId/runs', component: WorkflowRunsPageComponent }]),
        provideNoopAnimations(),
        { provide: ArazzoRunHistoryService, useValue: history },
        { provide: ArazzoDocumentsService, useValue: { getDocuments: () => of([PASTRY_SCENARIOS]) } }
      ]
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, WorkflowRunsPageComponent);
    page = harness.routeNativeElement as HTMLElement;
    await settle();
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function texts(selector: string, root: ParentNode = page): string[] {
    return Array.from(root.querySelectorAll(selector)).map(element => normalized(element.textContent));
  }

  function normalized(text: string | null): string {
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  function rows(): string[] {
    return Array.from(page.querySelectorAll('.workflow-runs-table tbody tr')).map(row => texts('td', row).join(' | '));
  }

  async function choose(selector: string, label: string): Promise<void> {
    const select = page.querySelector(selector) as HTMLSelectElement;
    const option = Array.from(select.options).find(candidate => normalized(candidate.textContent) === label)!;
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  it('is the page of the runs history route of a document', () => {
    expect(routes.find(route => route.path === 'workflows/documents/:documentId/runs')?.component)
      .toBe(WorkflowRunsPageComponent);
  });

  it('lists the runs newest first, each with its workflow, target, result, failed step and duration', async () => {
    await open();

    expect(texts('.breadcrumb li')).toEqual(['Workflows', 'API Pastry scenarios - 1.0.0', 'Runs']);
    expect(Array.from(page.querySelectorAll('.breadcrumb a')).map(link => link.getAttribute('href')))
      .toEqual(['/workflows', '/workflows/pastry-doc/readThenReprice']);
    expect(texts('h1')).toEqual(['Runs history']);
    expect(texts('.workflow-runs-subtitle')).toEqual(['API Pastry scenarios 1.0.0 · every run of its workflows, newest first']);
    expect(texts('.workflow-runs-table th'))
      .toEqual(['Run', 'Workflow', 'Target', 'Result', 'Failed step', 'Started', 'Duration']);
    expect(rows()).toEqual([
      '#3 | listThenReadFirst | Microcks mocks | Failed | readFirst | 3 hours ago | 15 ms',
      '#2 | readThenReprice | Implementation | Failed | reprice | 5 hours ago | 58 ms',
      '#1 | readThenReprice | Microcks mocks | Passed | — | 2 days ago | 24 ms'
    ]);
    expect(Array.from(page.querySelectorAll('.workflow-runs-number')).map(link => link.getAttribute('href')))
      .toEqual(['/workflows/runs/run-3', '/workflows/runs/run-2', '/workflows/runs/run-1']);
    expect(texts('.workflow-runs-count')).toEqual(['3 runs · 1 passed · 2 failed']);
  });

  it('lists only the failed runs when filtering on Failed', async () => {
    await open();

    await choose('#workflow-runs-result', 'Failed');

    expect(rows().map(row => row.split(' | ')[0])).toEqual(['#3', '#2']);
    expect(texts('.workflow-runs-count')).toEqual(['2 runs · 0 passed · 2 failed']);
    expect(TestBed.inject(Router).url).toEqual('/workflows/documents/pastry-doc/runs?result=FAILURE');
  });

  it('combines the filters on the workflow and the target', async () => {
    await open();
    expect(texts('#workflow-runs-workflow option')).toEqual(['All workflows', 'readThenReprice', 'listThenReadFirst']);
    expect(texts('#workflow-runs-target option')).toEqual(['All targets', 'Microcks mocks', 'Implementations']);
    expect(texts('#workflow-runs-result option')).toEqual(['All results', 'Passed', 'Failed', 'In progress']);

    await choose('#workflow-runs-workflow', 'readThenReprice');
    await choose('#workflow-runs-target', 'Implementations');

    expect(rows().map(row => row.split(' | ')[0])).toEqual(['#2']);
    expect(history.asked[history.asked.length - 1]).toEqual({ documentId: 'pastry-doc',
      filter: { workflow: 'readThenReprice', target: 'IMPLEMENTATIONS' }, page: 1, size: 20 });
  });

  it('opens with the filters of its URL, as the recent runs of a workflow link to it', async () => {
    await open('/workflows/documents/pastry-doc/runs?workflow=readThenReprice');

    expect((page.querySelector('#workflow-runs-workflow') as HTMLSelectElement).value).toEqual('readThenReprice');
    expect(rows().map(row => row.split(' | ')[0])).toEqual(['#2', '#1']);
  });

  it('says when no run matches the filters, and when the workflows never ran', async () => {
    await open('/workflows/documents/pastry-doc/runs?result=IN_PROGRESS');
    expect(texts('.workflow-runs-empty')).toEqual(['No run matches the filters.']);

    TestBed.resetTestingModule();
    await open('/workflows/documents/pastry-doc/runs', []);
    expect(texts('.workflow-runs-empty')).toEqual(['No workflow of this document has run yet.']);
  });

  it('shows the runs page by page once there are more than 20', async () => {
    const runs = Array.from({ length: 25 }, (_, index) => ({ ...pastryRuns()[2], id: 'run-' + (25 - index),
      number: 25 - index }));
    await open('/workflows/documents/pastry-doc/runs', runs);
    expect(rows().length).toEqual(20);

    (page.querySelector('.pagination-pf-forward a[title="Next Page"]') as HTMLElement).click();
    await settle();

    expect(rows().map(row => row.split(' | ')[0])).toEqual(['#5', '#4', '#3', '#2', '#1']);
  });

  it('shows the recorded example each run played and whether it matches it', async () => {
    const runs = pastryRuns();
    runs[0] = { ...runs[0], example: 'unknown-first-pastry', exampleVerdict: 'MATCHES' };
    runs[2] = { ...runs[2], example: 'eclair-repriced', exampleVerdict: 'DOES_NOT_MATCH' };
    runs.unshift({ ...runs[2], id: 'run-4', number: 4, status: 'IN_PROGRESS', example: 'millefeuille-repriced',
      exampleVerdict: undefined, startedDate: Date.now() - HOUR });
    await open('/workflows/documents/pastry-doc/runs', runs);

    expect(rows().map(row => row.split(' | ').slice(0, 2).join(' | '))).toEqual([
      '#4 | readThenReprice example millefeuille-repriced',
      '#3 | listThenReadFirst example unknown-first-pastry · Matches',
      '#2 | readThenReprice',
      '#1 | readThenReprice example eclair-repriced · Does not match'
    ]);
    expect(page.querySelectorAll('.workflow-runs-example-matches').length).toEqual(1);
    expect(page.querySelectorAll('.workflow-runs-example-not-matching').length).toEqual(1);
  });
});
