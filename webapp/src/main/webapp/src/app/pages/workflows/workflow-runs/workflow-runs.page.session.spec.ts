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
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ArazzoDocumentsService } from '../../../services/arazzo-documents.service';
import { ArazzoRunHistoryService } from '../../../services/arazzo-run-history.service';
import { FakeRunHistory, pastryRuns } from '../../../../test-data/arazzo-run-history';
import { WorkflowRunsPageComponent } from './workflow-runs.page';

/** S15: the runs history marks the verifications of sessions with a neutral chip. */
describe('WorkflowRunsPageComponent verifications of sessions', () => {

  it('marks the verifications of sessions, apart from the runs', async () => {
    const runs = pastryRuns();
    runs[0].origin = 'SESSION';
    runs[1].origin = 'MOCK_URL';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'workflows/documents/:documentId/runs', component: WorkflowRunsPageComponent }]),
        provideNoopAnimations(),
        { provide: ArazzoRunHistoryService, useValue: new FakeRunHistory(runs) },
        { provide: ArazzoDocumentsService, useValue: { getDocuments: () => of([]) } }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/workflows/documents/pastry-doc/runs', WorkflowRunsPageComponent);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    const page = harness.routeNativeElement as HTMLElement;

    expect(Array.from(page.querySelectorAll('tbody tr')).map(row =>
      (row.querySelector('.workflow-runs-number')?.textContent ?? '') + ' '
        + (row.querySelector('.arazzo-run-origin')?.textContent?.trim() ?? '-'))).toEqual([
      '#3 Session', '#2 Mock URL', '#1 -'
    ]);
    expect(page.querySelector('tbody tr .arazzo-run-origin')?.getAttribute('title'))
      .toEqual('Verification of the calls an application made to the mocks in a session');
  });
});
