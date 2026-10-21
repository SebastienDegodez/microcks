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
import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnInit, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';

import { BehaviorSubject, Observable, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, startWith, switchMap } from 'rxjs/operators';

import {
  ArazzoDataPassing,
  ArazzoExpressionUse,
  ArazzoStepDetail,
  ArazzoWorkflowDetail,
  ArazzoWorkflowInput
} from '../../../models/arazzo-workflow.model';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { ArazzoRunHistoryService } from '../../../services/arazzo-run-history.service';
import { WorkflowRunSummary } from '../../../models/arazzo-run.model';
import { BsModalService } from 'ngx-bootstrap/modal';
import { openRunDialog } from '../workflow-run-dialog/workflow-run.dialog';
import { TimeAgoPipe } from '../../../components/time-ago.pipe';
import { ImportArazzoDialogComponent } from '../import-arazzo-dialog/import-arazzo-dialog.component';
import { WorkflowDiagramComponent } from './workflow-diagram/workflow-diagram.component';

/** The steps as cards, or the workflow as a diagram; the URL keeps it as ?view=diagram so a link can be shared. */
export type WorkflowView = 'steps' | 'diagram';

/** How many runs of the workflow its page shows under Recent runs. */
export const RECENT_RUNS = 3;

/** The last runs of the workflow, and the last run of each workflow of its document, by workflow id. */
export type WorkflowRunHistory = { recent: WorkflowRunSummary[]; lastRuns: Record<string, WorkflowRunSummary> };

const NO_RUN_HISTORY: WorkflowRunHistory = { recent: [], lastRuns: {} };

/** The workflow read from the API, or null when it does not exist, the view it is shown in, and its runs. */
type WorkflowState = { workflow: ArazzoWorkflowDetail | null; view: WorkflowView; history: WorkflowRunHistory };

@Component({
  selector: 'app-workflow-detail-page',
  templateUrl: './workflow-detail.page.html',
  styleUrls: ['./workflow-detail.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TimeAgoPipe,
    WorkflowDiagramComponent
  ]
})
export class WorkflowDetailPageComponent implements OnInit {

  state!: Observable<WorkflowState>;

  /** Emits to read the workflow again, once the links of its sources changed. */
  private readonly reload = new BehaviorSubject<void>(undefined);

  constructor(private workflowSvc: ArazzoWorkflowService, private route: ActivatedRoute, private router: Router,
              private host: ElementRef<HTMLElement>, private injector: Injector, private modalService: BsModalService,
              private historySvc: ArazzoRunHistoryService) {
  }

  ngOnInit(): void {
    const workflow = combineLatest([this.route.paramMap, this.reload]).pipe(
      switchMap(([params]: [ParamMap, void]) =>
        this.workflowSvc.getWorkflow(params.get('documentId')!, params.get('workflowId')!).pipe(
          catchError(() => of(null))
        )),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    // The recent runs and the tab icons read the same history query as the runs history page.
    const history = workflow.pipe(
      switchMap(workflow => workflow ? this.historyOf(workflow).pipe(startWith(NO_RUN_HISTORY)) : of(NO_RUN_HISTORY))
    );
    const view = this.route.queryParamMap.pipe(
      map(params => (params.get('view') === 'diagram' ? 'diagram' : 'steps') as WorkflowView)
    );
    this.state = combineLatest([workflow, view, history])
      .pipe(map(([workflow, view, history]) => ({ workflow, view, history })));
  }

  private historyOf(workflow: ArazzoWorkflowDetail): Observable<WorkflowRunHistory> {
    const lastRuns = workflow.workflowIds.map(workflowId =>
      this.historySvc.getRuns(workflow.documentId, { workflow: workflowId }, 1, 1)
        .pipe(map(runs => [workflowId, runs[0]] as [string, WorkflowRunSummary])));
    return combineLatest([
      this.historySvc.getRuns(workflow.documentId, { workflow: workflow.workflowId }, 1, RECENT_RUNS),
      forkJoin(lastRuns)
    ]).pipe(
      map(([recent, last]) => ({ recent, lastRuns: Object.fromEntries(last.filter(([, run]) => run)) })),
      catchError(() => of(NO_RUN_HISTORY))
    );
  }

  /** The icon of how a run went, in its color. */
  statusIcon(run: WorkflowRunSummary): string {
    switch (run.status) {
      case 'SUCCESS': return 'pficon-ok arazzo-run-passed';
      case 'FAILURE': return 'pficon-error-circle-o arazzo-run-failed';
      default: return 'pficon-in-progress';
    }
  }

  /** How a run went: "Passed", "Failed at reprice" or "In progress". */
  outcome(run: WorkflowRunSummary): string {
    switch (run.status) {
      case 'SUCCESS': return 'Passed';
      case 'FAILURE': return run.failedStepId ? 'Failed at ' + run.failedStepId : 'Failed';
      default: return 'In progress';
    }
  }

  /** What the tab of a workflow tells of its last run. */
  lastRunTitle(run: WorkflowRunSummary): string {
    switch (run.status) {
      case 'SUCCESS': return 'Last run passed';
      case 'FAILURE': return 'Last run failed';
      default: return 'Last run in progress';
    }
  }

  targetOf(run: WorkflowRunSummary): string {
    return run.target === 'MOCKS' ? 'Microcks mocks' : 'implementation';
  }

  /** When the run started, for the time-ago pipe. */
  startedOn(run: WorkflowRunSummary): string {
    return new Date(run.startedDate).toISOString();
  }

  showView(view: WorkflowView): Promise<boolean> {
    return this.router.navigate([], { relativeTo: this.route, queryParamsHandling: 'merge',
      queryParams: { view: view === 'diagram' ? 'diagram' : null } });
  }

  /** Shows the steps view and scrolls to the card of the step chosen in the diagram. */
  openStep(stepId: string): void {
    this.showView('steps').then(() => afterNextRender(() => {
      const card = this.host.nativeElement.querySelector('[data-step-id="' + CSS.escape(stepId) + '"]');
      card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, { injector: this.injector }));
  }

  /** Why the workflow cannot run, shown on its disabled Run button; null when it can run. */
  notRunnableReason(workflow: ArazzoWorkflowDetail): string | null {
    return workflow.status.runnable ? null : workflow.status.reasons.join(', ');
  }

  openRun(workflow: ArazzoWorkflowDetail): void {
    openRunDialog(this.modalService, workflow.documentId, workflow.workflowIds, workflow.workflowId);
  }

  /** Open the linking step of the import dialog on the document of the workflow, then read the workflow again. */
  openLinkSources(workflow: ArazzoWorkflowDetail): void {
    this.modalService
      .show(ImportArazzoDialogComponent, {
        class: 'arazzo-import-modal',
        ariaLabelledBy: 'arazzo-import-title',
        initialState: { documentId: workflow.documentId, fileName: workflow.fileName },
      })
      .onHidden?.subscribe(() => this.reload.next());
  }

  /** A value is a runtime expression when it starts with $ or embeds one in braces; otherwise it is a constant. */
  isExpression(value: string): boolean {
    return value.startsWith('$') || value.includes('{$');
  }

  /** The data passed to a step by earlier steps, shown just before it. */
  passingsTo(workflow: ArazzoWorkflowDetail, step: ArazzoStepDetail): ArazzoDataPassing[] {
    return workflow.dataPassings.filter(passing => passing.to.stepId === step.stepId);
  }

  /** Where an input is used, grouped by step in the order of the steps: "reprice · body /price, criterion". */
  inputUseGroups(input: ArazzoWorkflowInput): { stepId: string; uses: ArazzoExpressionUse[] }[] {
    const groups: { stepId: string; uses: ArazzoExpressionUse[] }[] = [];
    input.usedBy.forEach(use => {
      const last = groups[groups.length - 1];
      if (last && last.stepId === use.stepId) {
        last.uses.push(use);
      } else {
        groups.push({ stepId: use.stepId, uses: [use] });
      }
    });
    return groups;
  }

  /** The Microcks API a step calls, found through the source description of its operation. */
  serviceIdOf(workflow: ArazzoWorkflowDetail, step: ArazzoStepDetail): string | undefined {
    return workflow.sources.find(source => source.link.sourceName === step.operation.sourceName)?.serviceId;
  }

  /** The import date as the time-ago pipe reads it, whether the API gives it as a timestamp or an ISO string. */
  importDateOf(workflow: ArazzoWorkflowDetail): string {
    return new Date(workflow.importDate).toISOString();
  }

  entries(expressions: Record<string, string>): { name: string; expression: string }[] {
    return Object.entries(expressions).map(([name, expression]) => ({ name, expression }));
  }
}
