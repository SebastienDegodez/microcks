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
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { routes } from '../../app.routes';
import { ArazzoDocumentSummary } from '../../models/arazzo-document.model';
import { ServiceType } from '../../models/service.model';
import { ArazzoDocumentsService } from '../../services/arazzo-documents.service';
import { UploaderDialogService } from '../../services/uploader-dialog.service';
import { WorkflowsPageComponent } from './workflows.page';

const PASTRY_SCENARIOS: ArazzoDocumentSummary = {
  id: 'pastry-doc',
  title: 'API Pastry scenarios',
  version: '1.0.0',
  arazzoVersion: '1.0.1',
  fileName: 'pastry.arazzo.yaml',
  importDate: Date.now() - 2 * 24 * 3600 * 1000,
  sources: [
    {
      link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
      apiId: 'pastry-api',
      apiType: ServiceType.REST,
    },
  ],
  workflows: [
    {
      status: { workflowId: 'readThenReprice', runnable: true, reasons: [] },
      description: 'Reads a pastry, then changes its price using the name returned by the first call.',
      stepCount: 2,
      lastResult: 'NEVER_RUN',
    },
    {
      status: { workflowId: 'listThenReadFirst', runnable: true, reasons: [] },
      description: 'Reads the first pastry of the list.',
      stepCount: 2,
      lastResult: 'NEVER_RUN',
    },
  ],
};

const ORDER_FULFILMENT: ArazzoDocumentSummary = {
  id: 'order-doc',
  title: 'Order fulfilment',
  version: '1.0.0',
  arazzoVersion: '1.0.1',
  fileName: 'place-order.arazzo.yaml',
  importDate: Date.now() - 10 * 60 * 1000,
  sources: [
    {
      link: { sourceName: 'customerApi', apiName: 'Customer API', apiVersion: '1.0.0', linked: true },
      apiId: 'customer-api',
      apiType: ServiceType.REST,
    },
    {
      link: { sourceName: 'orderApi', apiName: 'Order API', apiVersion: '1.0.0', linked: false },
      apiId: null,
      apiType: null,
    },
  ],
  workflows: [
    {
      status: { workflowId: 'searchThenRead', runnable: true, reasons: [] },
      description: null,
      stepCount: 1,
      lastResult: 'NEVER_RUN',
    },
    {
      status: { workflowId: 'placeOrder', runnable: false, reasons: ['API Order API 1.0.0 not found'] },
      description: 'Reads a customer, then places an order for this customer.',
      stepCount: 2,
      lastResult: 'NEVER_RUN',
    },
  ],
};

/** Answers like the endpoint: every document, or only the documents using the API filtered on. */
class FakeArazzoDocumentsService {
  constructor(private documents: ArazzoDocumentSummary[]) {}

  getDocuments(api?: string) {
    return of(
      this.documents.filter((document) => !api || document.sources.some((source) => source.link.apiName === api))
    );
  }
}

describe('WorkflowsPageComponent', () => {
  let uploaderDialog: jasmine.SpyObj<UploaderDialogService>;

  function openPage(documents: ArazzoDocumentSummary[]): ComponentFixture<WorkflowsPageComponent> {
    uploaderDialog = jasmine.createSpyObj<UploaderDialogService>('UploaderDialogService', [
      'openArtifactUploader',
      'registerPageRefreshCallback',
      'unregisterPageRefreshCallback',
    ]);
    TestBed.configureTestingModule({
      imports: [WorkflowsPageComponent],
      providers: [
        provideRouter([]),
        { provide: ArazzoDocumentsService, useValue: new FakeArazzoDocumentsService(documents) },
        { provide: UploaderDialogService, useValue: uploaderDialog },
      ],
    });
    const fixture = TestBed.createComponent(WorkflowsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function element(fixture: ComponentFixture<WorkflowsPageComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texts(fixture: ComponentFixture<WorkflowsPageComponent>, selector: string): string[] {
    return Array.from(element(fixture).querySelectorAll(selector)).map((node) =>
      (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
  }

  it('is the page of the /workflows route', () => {
    expect(routes.find((route) => route.path === 'workflows')?.component).toBe(WorkflowsPageComponent);
  });

  it('lists a document with its file, its APIs and its workflows, never run', () => {
    const fixture = openPage([PASTRY_SCENARIOS]);

    expect(texts(fixture, '.workflows-document-title')).toEqual(['API Pastry scenarios']);
    expect(texts(fixture, '.workflows-document-version')).toEqual(['1.0.0']);
    expect(texts(fixture, '.workflows-arazzo-chip')).toEqual(['ARAZZO 1.0.1']);
    expect(texts(fixture, '.workflows-document-file')).toEqual(['pastry.arazzo.yaml · imported 2 days ago']);
    expect(texts(fixture, '.workflows-source')).toEqual(['REST API Pastry - 2.0 2.0.0']);
    expect(texts(fixture, '.workflows-workflow-id')).toEqual(['readThenReprice', 'listThenReadFirst']);
    expect(texts(fixture, '.workflows-workflow-meta')).toEqual([
      'Reads a pastry, then changes its price using the name returned by the first call. · 2 steps',
      'Reads the first pastry of the list. · 2 steps',
    ]);
    expect(texts(fixture, '.workflows-workflow-result')).toEqual(['Never run', 'Never run']);
  });

  it('links a linked API to its page and a workflow to its detail page', () => {
    const fixture = openPage([PASTRY_SCENARIOS]);

    const apiLink = element(fixture).querySelector('.workflows-source a') as HTMLAnchorElement;
    expect(apiLink.getAttribute('href')).toBe('/services/pastry-api');
    const workflowLinks = Array.from(element(fixture).querySelectorAll('a.workflows-workflow-id'));
    expect(workflowLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/workflows/pastry-doc/readThenReprice',
      '/workflows/pastry-doc/listThenReadFirst',
    ]);
  });

  it('says that a source is not linked and why a workflow cannot run', () => {
    const fixture = openPage([ORDER_FULFILMENT]);

    expect(texts(fixture, '.workflows-source')).toEqual(['REST Customer API 1.0.0', 'orderApi not linked']);
    expect(texts(fixture, '.workflows-document-result')).toEqual(['Never run']);
    expect(texts(fixture, '.workflows-workflow-meta')).toEqual([
      '1 step',
      'Reads a customer, then places an order for this customer. · 2 steps',
    ]);
    expect(texts(fixture, '.workflows-workflow-reasons')).toEqual(['Not runnable: API Order API 1.0.0 not found']);
  });

  it('shows nothing of what a document stored before this page did not keep', () => {
    const fixture = openPage([
      {
        ...PASTRY_SCENARIOS,
        arazzoVersion: null,
        fileName: null,
        importDate: null,
        workflows: PASTRY_SCENARIOS.workflows.map((workflow) => ({ ...workflow, description: null })),
      },
    ]);

    expect(element(fixture).querySelectorAll('.workflows-arazzo-chip').length).toBe(0);
    expect(texts(fixture, '.workflows-document-file')).toEqual(['']);
    expect(texts(fixture, '.workflows-workflow-meta')).toEqual(['2 steps', '2 steps']);

    (element(fixture).querySelector('.workflows-document-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(texts(fixture, '.workflows-document-file')).toEqual(['2 workflows']);
  });

  it('explains what workflows are and offers to import an Arazzo document when none is imported', () => {
    const fixture = openPage([]);

    const emptyState = element(fixture).querySelector('.blank-slate-pf') as HTMLElement;
    expect(emptyState.textContent).toContain('Multi-step API journeys described with Arazzo');
    expect(element(fixture).querySelectorAll('.workflows-document').length).toBe(0);
    (emptyState.querySelector('button') as HTMLButtonElement).click();
    expect(uploaderDialog.openArtifactUploader).toHaveBeenCalled();
  });

  it('opens the import dialog from the page header', () => {
    const fixture = openPage([PASTRY_SCENARIOS]);

    (element(fixture).querySelector('.workflows-import') as HTMLButtonElement).click();

    expect(uploaderDialog.openArtifactUploader).toHaveBeenCalled();
  });

  it('lists only the documents using the API filtered on', async () => {
    const fixture = openPage([PASTRY_SCENARIOS, ORDER_FULFILMENT]);
    const apiFilter = element(fixture).querySelector('#workflows-api-filter') as HTMLSelectElement;
    expect(Array.from(apiFilter.options).map((option) => option.textContent?.trim())).toEqual([
      'All APIs',
      'API Pastry - 2.0',
      'Customer API',
      'Order API',
    ]);

    apiFilter.value = apiFilter.options[1].value;
    apiFilter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texts(fixture, '.workflows-document-title')).toEqual(['API Pastry scenarios']);
    expect(texts(fixture, '.workflows-count')).toEqual(['1 document · 2 workflows']);
  });

  it('lists only the documents whose title or workflow matches the name filtered on', async () => {
    const fixture = openPage([PASTRY_SCENARIOS, ORDER_FULFILMENT]);
    expect(texts(fixture, '.workflows-count')).toEqual(['2 documents · 4 workflows']);
    const nameFilter = element(fixture).querySelector('#workflows-name-filter') as HTMLInputElement;

    nameFilter.value = 'placeorder';
    nameFilter.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(texts(fixture, '.workflows-document-title')).toEqual(['Order fulfilment']);
  });

  it('shows the run controls disabled until workflows can run', () => {
    const fixture = openPage([PASTRY_SCENARIOS]);

    const runButtons = Array.from(element(fixture).querySelectorAll('button.workflows-run')) as HTMLButtonElement[];
    expect(runButtons.length).toBe(2);
    expect(runButtons.every((button) => button.disabled)).toBeTrue();
    const resultFilter = element(fixture).querySelector('#workflows-result-filter') as HTMLSelectElement;
    expect(resultFilter.disabled).toBeTrue();
    const availableSoon = Array.from(element(fixture).querySelectorAll('[title="Available soon"]'));
    expect(availableSoon.length).toBe(3);
  });

  it('expands the first document only, and counts the workflows of a collapsed one', () => {
    const fixture = openPage([PASTRY_SCENARIOS, ORDER_FULFILMENT]);

    expect(texts(fixture, '.workflows-workflow-id')).toEqual(['readThenReprice', 'listThenReadFirst']);
    expect(texts(fixture, '.workflows-document-file')).toEqual([
      'pastry.arazzo.yaml · imported 2 days ago',
      'place-order.arazzo.yaml · imported 10 minutes ago · 2 workflows',
    ]);
  });

  it('collapses and expands the workflows of a document', () => {
    const fixture = openPage([PASTRY_SCENARIOS, ORDER_FULFILMENT]);
    const toggles = element(fixture).querySelectorAll('.workflows-document-toggle');

    (toggles[0] as HTMLButtonElement).click();
    (toggles[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(texts(fixture, '.workflows-workflow-id')).toEqual(['searchThenRead', 'placeOrder']);

    (element(fixture).querySelectorAll('.workflows-document-title')[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(element(fixture).querySelectorAll('.workflows-workflow').length).toBe(4);
  });
});
