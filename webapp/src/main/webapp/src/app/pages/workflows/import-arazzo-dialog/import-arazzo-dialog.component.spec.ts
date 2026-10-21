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
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { of, Subject, throwError } from 'rxjs';

import {
  ArazzoDocumentSummary,
  ArazzoImportAnalysis,
  ArazzoSourceAnalysis,
  ArazzoSourceLinks,
} from '../../../models/arazzo-document.model';
import { ArazzoDocumentsService } from '../../../services/arazzo-documents.service';
import { UploaderDialogService } from '../../../services/uploader-dialog.service';
import { ImportArazzoDialogComponent } from './import-arazzo-dialog.component';

const CUSTOMER_API = { name: 'Customer API', version: '1.0.0' };
const ORDER_API_URL = 'https://contracts.example.com/order-api.openapi.yaml';

const CUSTOMER_SOURCE_MATCHED: ArazzoSourceAnalysis = {
  sourceName: 'customerApi',
  declaredUrl: 'https://contracts.example.com/customer-api.openapi.yaml',
  match: { status: 'MATCHED', contractTitle: 'Customer API', contractVersion: '1.0.0' },
  link: { sourceName: 'customerApi', apiName: 'Customer API', apiVersion: '1.0.0', linked: true },
  operationCount: 2,
  foundOperationCount: 2,
  unresolvedStepCount: 0,
};

const ORDER_SOURCE_NO_API: ArazzoSourceAnalysis = {
  sourceName: 'orderApi',
  declaredUrl: ORDER_API_URL,
  match: { status: 'NO_API', contractTitle: 'Order API', contractVersion: '1.0.0' },
  link: { sourceName: 'orderApi', apiName: null, apiVersion: null, linked: false },
  operationCount: 2,
  foundOperationCount: 0,
  unresolvedStepCount: 2,
};

/** The analysis of place-order.arazzo.yaml when Customer API is in Microcks and Order API is not. */
const ORDER_FULFILMENT: ArazzoImportAnalysis = {
  refusal: null,
  arazzoVersion: '1.0.1',
  title: 'Order fulfilment',
  version: '1.0.0',
  workflowIds: ['searchThenRead', 'placeOrder'],
  sources: [CUSTOMER_SOURCE_MATCHED, ORDER_SOURCE_NO_API],
  checks: [
    { workflowId: 'searchThenRead', runnable: true, apiNames: ['Customer API'], unlinkedSources: [], reasons: [] },
    { workflowId: 'placeOrder', runnable: false, apiNames: [], unlinkedSources: ['orderApi'], reasons: [] },
  ],
  apis: [CUSTOMER_API, { name: 'API Pastry - 2.0', version: '2.0.0' }],
};

/** The same analysis once orderApi is linked to Customer API, which does not define its operations. */
const ORDER_API_LINKED_TO_CUSTOMER_API: ArazzoImportAnalysis = {
  ...ORDER_FULFILMENT,
  sources: [
    CUSTOMER_SOURCE_MATCHED,
    {
      ...ORDER_SOURCE_NO_API,
      link: { sourceName: 'orderApi', apiName: 'Customer API', apiVersion: '1.0.0', linked: true },
    },
  ],
  checks: [
    ORDER_FULFILMENT.checks[0],
    {
      workflowId: 'placeOrder',
      runnable: false,
      apiNames: ['Customer API'],
      unlinkedSources: [],
      reasons: ['Operation CreateOrder not found in Customer API 1.0.0'],
    },
  ],
};

/** An uploaded document whose source declares a relative url, that cannot be read. */
const RELATIVE_URL: ArazzoImportAnalysis = {
  ...ORDER_FULFILMENT,
  sources: [
    {
      ...CUSTOMER_SOURCE_MATCHED,
      declaredUrl: './customer-api.openapi.yaml',
      match: { status: 'UNREADABLE', contractTitle: null, contractVersion: null },
      link: { sourceName: 'customerApi', apiName: null, apiVersion: null, linked: false },
      foundOperationCount: 0,
      unresolvedStepCount: 2,
    },
    ORDER_SOURCE_NO_API,
  ],
};

const NO_INFO: ArazzoImportAnalysis = {
  refusal: 'Invalid Arazzo document: info.title is required',
  arazzoVersion: null,
  title: null,
  version: null,
  workflowIds: [],
  sources: [],
  checks: [],
  apis: [CUSTOMER_API],
};

/** Answers each analysis with the next of the given ones. */
class FakeArazzoDocumentsService {
  analyses: { content: string; links?: ArazzoSourceLinks }[] = [];
  imports: { content: string; fileName: string; links: ArazzoSourceLinks }[] = [];
  importAnswer = of({ id: 'order-doc' } as ArazzoDocumentSummary);

  constructor(private answers: ArazzoImportAnalysis[]) {}

  analyseDocument(content: string, links?: ArazzoSourceLinks) {
    this.analyses.push({ content, links });
    return of(this.answers[Math.min(this.analyses.length, this.answers.length) - 1]);
  }

  importDocument(content: string, fileName: string, links: ArazzoSourceLinks) {
    this.imports.push({ content, fileName, links });
    return this.importAnswer;
  }
}

describe('ImportArazzoDialogComponent', () => {
  const PLACE_ORDER = 'arazzo: 1.0.1\ninfo:\n  title: Order fulfilment\n  version: 1.0.0\n';

  let documentsService: FakeArazzoDocumentsService;
  let modalRef: jasmine.SpyObj<BsModalRef>;
  let uploaderDialog: jasmine.SpyObj<UploaderDialogService>;
  let uploaderHidden: Subject<unknown>;

  function openDialog(...answers: ArazzoImportAnalysis[]): ComponentFixture<ImportArazzoDialogComponent> {
    documentsService = new FakeArazzoDocumentsService(answers);
    modalRef = jasmine.createSpyObj<BsModalRef>('BsModalRef', ['hide']);
    uploaderDialog = jasmine.createSpyObj<UploaderDialogService>('UploaderDialogService', [
      'openArtifactDownloadWithUrl',
    ]);
    uploaderHidden = new Subject<unknown>();
    uploaderDialog.openArtifactDownloadWithUrl.and.returnValue({ onHidden: uploaderHidden } as unknown as BsModalRef);
    TestBed.configureTestingModule({
      imports: [ImportArazzoDialogComponent],
      providers: [
        { provide: ArazzoDocumentsService, useValue: documentsService },
        { provide: BsModalRef, useValue: modalRef },
        { provide: UploaderDialogService, useValue: uploaderDialog },
      ],
    });
    const fixture = TestBed.createComponent(ImportArazzoDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  async function dropDocument(fixture: ComponentFixture<ImportArazzoDialogComponent>): Promise<void> {
    await fixture.componentInstance.selectFile(new File([PLACE_ORDER], 'place-order.arazzo.yaml'));
    await stable(fixture);
  }

  /** Render the dialog, then once more after ngModel wrote the API picked in each list. */
  async function stable(fixture: ComponentFixture<ImportArazzoDialogComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function element(fixture: ComponentFixture<ImportArazzoDialogComponent>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(node: Element | null): string {
    return (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function texts(fixture: ComponentFixture<ImportArazzoDialogComponent>, selector: string): string[] {
    return Array.from(element(fixture).querySelectorAll(selector)).map(text);
  }

  function sourceRows(fixture: ComponentFixture<ImportArazzoDialogComponent>): HTMLElement[] {
    return Array.from(element(fixture).querySelectorAll('.arazzo-import-sources tbody tr'));
  }

  function selectedApi(row: HTMLElement): string {
    const select = row.querySelector('select') as HTMLSelectElement;
    return text(select.options[select.selectedIndex]);
  }

  function importButton(fixture: ComponentFixture<ImportArazzoDialogComponent>): HTMLButtonElement {
    return element(fixture).querySelector('.arazzo-import-submit') as HTMLButtonElement;
  }

  // AC-01: The dropped document is validated before import

  it('asks for a document, and cannot import before one is dropped', () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    expect(text(element(fixture).querySelector('.arazzo-import-drop'))).toContain('Drop a .arazzo.yaml or .arazzo.json file');
    expect(importButton(fixture).disabled).toBeTrue();
    expect(element(fixture).querySelector('.arazzo-import-sources')).toBeNull();
  });

  it('validates the dropped document before import', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    const dropped = new DataTransfer();
    dropped.items.add(new File([PLACE_ORDER], 'place-order.arazzo.yaml'));
    const drop = new DragEvent('drop', { dataTransfer: dropped, cancelable: true });
    const reading = spyOn(fixture.componentInstance, 'selectFile').and.callThrough();
    element(fixture).querySelector('.arazzo-import-drop')?.dispatchEvent(drop);
    await reading.calls.mostRecent().returnValue;
    await stable(fixture);

    expect(drop.defaultPrevented).toBeTrue();
    expect(documentsService.analyses).toEqual([{ content: PLACE_ORDER, links: undefined }]);
    expect(texts(fixture, '.arazzo-import-file-name')).toEqual(['place-order.arazzo.yaml']);
    expect(texts(fixture, '.arazzo-import-validation')).toEqual([
      'Valid Arazzo 1.0.1 · title “Order fulfilment” 1.0.0 · 2 workflows · 2 source descriptions',
    ]);
    expect(importButton(fixture).disabled).toBeFalse();
  });

  it('validates the document chosen with the file picker', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    const chosen = new DataTransfer();
    chosen.items.add(new File([PLACE_ORDER], 'place-order.arazzo.yaml'));
    const input = element(fixture).querySelector('input[type=file]') as HTMLInputElement;
    input.files = chosen.files;
    const reading = spyOn(fixture.componentInstance, 'selectFile').and.callThrough();
    input.dispatchEvent(new Event('change'));
    await reading.calls.mostRecent().returnValue;
    await stable(fixture);

    expect(documentsService.analyses.length).toBe(1);
    expect(texts(fixture, '.arazzo-import-file-name')).toEqual(['place-order.arazzo.yaml']);
    expect(text(element(fixture).querySelector('.arazzo-import-choose'))).toBe('Choose another file');
  });

  it('highlights the drop target while a file is dragged over it', () => {
    const fixture = openDialog(ORDER_FULFILMENT);
    const target = element(fixture).querySelector('.arazzo-import-drop') as HTMLElement;

    const dragOver = new DragEvent('dragover', { cancelable: true });
    target.dispatchEvent(dragOver);
    fixture.detectChanges();
    expect(dragOver.defaultPrevented).toBeTrue();
    expect(target.classList).toContain('arazzo-import-dragging');

    target.dispatchEvent(new DragEvent('dragleave'));
    fixture.detectChanges();
    expect(target.classList).not.toContain('arazzo-import-dragging');
  });

  it('ignores a drop that holds no file', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    const drop = new DragEvent('drop', { dataTransfer: new DataTransfer(), cancelable: true });
    element(fixture).querySelector('.arazzo-import-drop')?.dispatchEvent(drop);
    await stable(fixture);

    expect(drop.defaultPrevented).toBeTrue();
    expect(documentsService.analyses).toEqual([]);
    expect(element(fixture).querySelector('.arazzo-import-file-name')).toBeNull();
  });

  it('ignores a file picker closed without a file', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    (element(fixture).querySelector('input[type=file]') as HTMLInputElement).dispatchEvent(new Event('change'));
    await stable(fixture);

    expect(documentsService.analyses).toEqual([]);
  });

  it('shows why an invalid document is refused, and cannot import it', async () => {
    const fixture = openDialog(NO_INFO);

    await dropDocument(fixture);

    expect(texts(fixture, '.arazzo-import-validation')).toEqual(['Invalid Arazzo document: info.title is required']);
    expect(element(fixture).querySelector('.arazzo-import-validation .text-danger, .arazzo-import-refused')).not.toBeNull();
    expect(element(fixture).querySelector('.arazzo-import-sources')).toBeNull();
    expect(element(fixture).querySelector('.arazzo-import-checks')).toBeNull();
    expect(importButton(fixture).disabled).toBeTrue();
  });

  // AC-02: A source is matched on the title and version of the contract it declares

  it('links a source to the API matched on the title and version of its contract', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    await dropDocument(fixture);

    const customerRow = sourceRows(fixture)[0];
    expect(text(customerRow.querySelector('.arazzo-import-source-name'))).toBe('customerApi');
    expect(text(customerRow.querySelector('.arazzo-import-declared-url'))).toBe(
      'https://contracts.example.com/customer-api.openapi.yaml'
    );
    expect(selectedApi(customerRow)).toBe('Customer API · 1.0.0');
    expect(text(customerRow.querySelector('.arazzo-import-hint'))).toBe('Matched on title and version');
    expect(text(customerRow.querySelector('.arazzo-import-operations'))).toBe('2 of 2 found');
    expect(customerRow.classList).not.toContain('arazzo-import-source-unlinked');
  });

  it('lists the APIs of Microcks for each source', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    await dropDocument(fixture);

    const select = sourceRows(fixture)[1].querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map(text)).toEqual([
      'Not linked',
      'Customer API · 1.0.0',
      'API Pastry - 2.0 · 2.0.0',
    ]);
  });

  // AC-03: A source whose API is missing says so and stays unlinked

  it('says when the API of a source is missing, and leaves it unlinked', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    await dropDocument(fixture);

    const orderRow = sourceRows(fixture)[1];
    expect(selectedApi(orderRow)).toBe('Not linked');
    expect(text(orderRow.querySelector('.arazzo-import-hint'))).toBe('No API titled “Order API” 1.0.0 in Microcks');
    expect(text(orderRow.querySelector('.arazzo-import-operations'))).toBe('2 steps unresolved');
    expect(orderRow.classList).toContain('arazzo-import-source-unlinked');
    expect(texts(fixture, '.arazzo-import-missing')).toEqual([
      'Order API is not in Microcks yet: import order-api.openapi.yaml first, or import now and link it later from the workflow page.',
    ]);
    expect(texts(fixture, '.arazzo-import-linked-count')).toEqual(['1 of 2 sources linked']);
  });

  it('asks to pick the API of a source whose declared URL cannot be read', async () => {
    const fixture = openDialog(RELATIVE_URL);

    await dropDocument(fixture);

    const customerRow = sourceRows(fixture)[0];
    expect(selectedApi(customerRow)).toBe('Not linked');
    expect(text(customerRow.querySelector('.arazzo-import-hint'))).toBe('Pick the API: the declared URL cannot be read');
    expect(customerRow.classList).not.toContain('arazzo-import-source-unlinked');
    expect(texts(fixture, '.arazzo-import-linked-count')).toEqual(['0 of 2 sources linked']);
  });

  it('leaves no hint under a matched source the developer chose not to link', async () => {
    const fixture = openDialog({
      ...ORDER_FULFILMENT,
      sources: [
        { ...CUSTOMER_SOURCE_MATCHED, link: { ...ORDER_SOURCE_NO_API.link, sourceName: 'customerApi' } },
        ORDER_SOURCE_NO_API,
      ],
    });

    await dropDocument(fixture);

    const customerRow = sourceRows(fixture)[0];
    expect(selectedApi(customerRow)).toBe('Not linked');
    expect(customerRow.querySelector('.arazzo-import-hint')).toBeNull();
    expect(customerRow.classList).toContain('arazzo-import-source-unlinked');
  });

  it('names every API and every unlinked source in the checks', async () => {
    const fixture = openDialog({
      ...ORDER_FULFILMENT,
      checks: [
        { workflowId: 'one', runnable: true, apiNames: ['A', 'B', 'C'], unlinkedSources: [], reasons: [] },
        { workflowId: 'two', runnable: false, apiNames: [], unlinkedSources: ['aApi', 'bApi'], reasons: [] },
      ],
    });

    await dropDocument(fixture);

    expect(texts(fixture, '.arazzo-import-checks li').slice(1)).toEqual([
      'one is ready to run: all its operations are in A, B and C.',
      'two cannot run until aApi and bApi are linked.',
    ]);
  });

  it('counts a single source in the singular', async () => {
    const fixture = openDialog({ ...ORDER_FULFILMENT, sources: [CUSTOMER_SOURCE_MATCHED] });

    await dropDocument(fixture);

    expect(texts(fixture, '.arazzo-import-linked-count')).toEqual(['1 of 1 source linked']);
  });

  it('tells which workflows are ready to run', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    await dropDocument(fixture);

    expect(texts(fixture, '.arazzo-import-checks li')).toEqual([
      'Runtime expressions and success criteria use the supported subset.',
      'searchThenRead is ready to run: all its operations are in Customer API.',
      'placeOrder cannot run until orderApi is linked.',
    ]);
  });

  it('imports the missing API from its declared URL with the generic import dialog, then matches again', async () => {
    const fixture = openDialog(ORDER_FULFILMENT, ORDER_FULFILMENT);
    await dropDocument(fixture);

    (element(fixture).querySelector('.arazzo-import-missing a') as HTMLAnchorElement).click();
    uploaderHidden.next(undefined);

    expect(uploaderDialog.openArtifactDownloadWithUrl).toHaveBeenCalledWith(ORDER_API_URL);
    expect(documentsService.analyses.length).toBe(2);
    expect(documentsService.analyses[1].links).toBeUndefined();
  });

  // AC-04: The developer can change a link before importing

  it('analyses the document again when another API is picked, recomputing the counts and the checks', async () => {
    const fixture = openDialog(ORDER_FULFILMENT, ORDER_API_LINKED_TO_CUSTOMER_API);
    await dropDocument(fixture);

    const select = sourceRows(fixture)[1].querySelector('select') as HTMLSelectElement;
    select.value = select.options[1].value;
    select.dispatchEvent(new Event('change'));
    await stable(fixture);

    expect(documentsService.analyses[1]).toEqual({
      content: PLACE_ORDER,
      links: { customerApi: CUSTOMER_API, orderApi: CUSTOMER_API },
    });
    const orderRow = sourceRows(fixture)[1];
    expect(selectedApi(orderRow)).toBe('Customer API · 1.0.0');
    expect(text(orderRow.querySelector('.arazzo-import-operations'))).toBe('0 of 2 found');
    expect(text(orderRow.querySelector('.arazzo-import-hint'))).toBe('');
    expect(texts(fixture, '.arazzo-import-checks li')[2]).toBe(
      'placeOrder cannot run: Operation CreateOrder not found in Customer API 1.0.0.'
    );
    expect(texts(fixture, '.arazzo-import-linked-count')).toEqual(['2 of 2 sources linked']);
  });

  it('analyses the document again when Not linked is picked', async () => {
    const fixture = openDialog(ORDER_FULFILMENT, ORDER_FULFILMENT);
    await dropDocument(fixture);

    const select = sourceRows(fixture)[0].querySelector('select') as HTMLSelectElement;
    select.value = select.options[0].value;
    select.dispatchEvent(new Event('change'));

    expect(documentsService.analyses[1].links).toEqual({ customerApi: null, orderApi: null });
  });

  // AC-05: Import stores the document and its links, all or nothing

  it('imports the document with the chosen links, then closes', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);
    await dropDocument(fixture);

    importButton(fixture).click();

    expect(documentsService.imports).toEqual([
      { content: PLACE_ORDER, fileName: 'place-order.arazzo.yaml', links: { customerApi: CUSTOMER_API, orderApi: null } },
    ]);
    expect(modalRef.hide).toHaveBeenCalled();
  });

  it('shows why an import is refused, and stays open', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);
    await dropDocument(fixture);
    documentsService.importAnswer = throwError(
      () => new HttpErrorResponse({ status: 400, error: 'Unknown source description: paymentApi' })
    ) as never;

    importButton(fixture).click();
    fixture.detectChanges();

    expect(texts(fixture, '.arazzo-import-error')).toEqual(['Unknown source description: paymentApi']);
    expect(modalRef.hide).not.toHaveBeenCalled();
  });

  it('shows the failure of an import the server gives no reason for', async () => {
    const fixture = openDialog(ORDER_FULFILMENT);
    await dropDocument(fixture);
    documentsService.importAnswer = throwError(
      () => new HttpErrorResponse({ status: 500, statusText: 'Server Error', url: '/api/arazzo/documents' })
    ) as never;

    importButton(fixture).click();
    fixture.detectChanges();

    expect(texts(fixture, '.arazzo-import-error')).toEqual([
      'Http failure response for /api/arazzo/documents: 500 Server Error',
    ]);
    expect(importButton(fixture).disabled).toBeFalse();
  });

  it('closes without importing on Cancel', () => {
    const fixture = openDialog(ORDER_FULFILMENT);

    (element(fixture).querySelector('.arazzo-import-cancel') as HTMLButtonElement).click();

    expect(modalRef.hide).toHaveBeenCalled();
    expect(documentsService.imports).toEqual([]);
  });
});
