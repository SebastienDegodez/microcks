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
import { HighlightJS } from 'ngx-highlightjs';

import { WorkflowResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { exhaustedRetries, passedAfterRetries } from '../../../../test-data/order-tracking';
import { WorkflowRunPageComponent } from './workflow-run.page';

/** S17: the run page shows each attempt of a retried step in its own slot, and why a run failed once retries ran out. */
describe('WorkflowRunPageComponent of a run whose steps were retried', () => {
  let fixture: ComponentFixture<WorkflowRunPageComponent>;

  function open(run: WorkflowResult): void {
    TestBed.configureTestingModule({
      imports: [WorkflowRunPageComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ runId: 'run-1' })) } },
        { provide: ArazzoRunService, useValue: { getRun: () => of(run), getExchanges: () => of([]) } },
        { provide: BsModalService, useValue: jasmine.createSpyObj<BsModalService>('BsModalService', ['show']) },
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

  function slots(): HTMLElement[] {
    return Array.from(page().querySelectorAll('.workflow-run-step'));
  }

  it('shows each attempt of a retried step in its own slot, numbered in execution order', fakeAsync(() => {
    open(passedAfterRetries());

    expect(texts('.workflow-run-step-title')).toEqual(['1 · pollStatus', '2 · pollStatus', '3 · pollStatus',
      '4 · readOrder']);
    expect(slots().map(slot => texts('.workflow-run-step-attempt', slot).join())).toEqual([
      'attempt 1 of 3, retried', 'attempt 2 of 3, retried', 'attempt 3 of 3', '']);
  }));

  it('passes without failure banner, the retried attempts collapsed', fakeAsync(() => {
    open(passedAfterRetries());

    expect(texts('.workflow-run-title')).toEqual(['Run #4 · waitUntilReady passed']);
    expect(texts('.workflow-run-failure')).toEqual([]);
    expect(page().querySelectorAll('.workflow-run-step-body').length).toEqual(0);
    expect(slots().map(slot => slot.classList.contains('workflow-run-step-failed')))
      .toEqual([true, true, false, false]);
  }));

  it('names the unmet criterion of the last attempt when the retries ran out, that attempt expanded', fakeAsync(() => {
    open(exhaustedRetries());

    expect(texts('.workflow-run-failure')).toEqual(['Step 2, pollStatus, failed after 2 attempts. Success criterion '
      + '$response.body#/status == \'ready\' did not hold: $response.body#/status was "preparing". The workflow stopped '
      + 'there and produced no outputs.']);
    expect(slots().map(slot => slot.querySelector('.workflow-run-step-body') !== null)).toEqual([false, true]);
    expect(texts('.workflow-run-step-attempt')).toEqual(['attempt 1 of 2, retried', 'attempt 2 of 2']);
  }));

  it('expands a retried attempt on demand', fakeAsync(() => {
    open(passedAfterRetries());

    (slots()[0].querySelector('.workflow-run-step-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(slots().map(slot => slot.querySelector('.workflow-run-step-body') !== null))
      .toEqual([true, false, false, false]);
    expect(Array.from(slots()[0].querySelectorAll('.workflow-run-criterion')).map(row => texts('td', row).join(' '))).toEqual([
      '$statusCode == 200 $statusCode = 200 Passed',
      '$response.body#/status == \'ready\' $response.body#/status = "preparing" Failed'
    ]);
  }));
});
