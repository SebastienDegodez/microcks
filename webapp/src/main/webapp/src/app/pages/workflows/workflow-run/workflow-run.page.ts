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
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, switchMap, takeWhile } from 'rxjs/operators';

import { BsModalService } from 'ngx-bootstrap/modal';

import { WorkflowCriterionResult, WorkflowResult, WorkflowStepResult } from '../../../models/arazzo-run.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { TimeAgoPipe } from '../../../components/time-ago.pipe';
import { openRunDialog } from '../workflow-run-dialog/workflow-run.dialog';

/** How often a run in progress is read again, in milliseconds. */
export const POLLING_INTERVAL = 2000;

/** The run read from the API, or null when it does not exist. */
type RunState = { run: WorkflowResult | null };

/** Why a run failed: at a step, with its unmet criteria or its message, or before any step tells it. */
export type RunFailure = {
  step?: WorkflowStepResult;
  unmet: WorkflowCriterionResult[];
  message?: string;
};

/** The page of a run of a workflow: its status, then its steps in the order they were executed. */
@Component({
  selector: 'app-workflow-run-page',
  templateUrl: './workflow-run.page.html',
  styleUrls: ['./workflow-run.page.css'],
  imports: [CommonModule, RouterLink, TimeAgoPipe]
})
export class WorkflowRunPageComponent implements OnInit {

  readonly availableSoon = 'Available soon';

  state!: Observable<RunState>;
  /** The steps the API developer collapsed, by index. */
  collapsed = new Set<number>();

  constructor(private runSvc: ArazzoRunService, private route: ActivatedRoute, private modals: BsModalService) {
  }

  ngOnInit(): void {
    // A run in progress is read again until it is final, so that the page follows it without reload.
    this.state = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => timer(0, POLLING_INTERVAL).pipe(
        switchMap(() => this.runSvc.getRun(params.get('runId')!)),
        takeWhile(run => run.status === 'IN_PROGRESS', true),
        map(run => ({ run }) as RunState),
        catchError(() => of({ run: null } as RunState))
      ))
    );
  }

  outcome(run: WorkflowResult): string {
    switch (run.status) {
      case 'SUCCESS': return 'passed';
      case 'FAILURE': return 'failed';
      default: return 'in progress';
    }
  }

  /** When the run started, for the time-ago pipe. */
  startedOn(run: WorkflowResult): string {
    return new Date(run.startedDate).toISOString();
  }

  /** Why the run failed; null when it did not. */
  failure(run: WorkflowResult): RunFailure | null {
    if (run.status !== 'FAILURE') {
      return null;
    }
    const step = run.steps.find(candidate => candidate.status === 'FAILED');
    if (!step) {
      return { unmet: [], message: run.message };
    }
    return { step, unmet: step.criteria.filter(criterion => !criterion.held), message: step.message };
  }

  /** What the unmet criteria saw: "the response status was 400", or the value of each expression. */
  evaluated(unmet: WorkflowCriterionResult[]): string {
    return unmet.flatMap(criterion => criterion.values).map(value => value.expression === '$statusCode'
      ? 'the response status was ' + value.value : value.expression + ' was ' + this.json(value.value)).join(', ');
  }

  isExpanded(step: WorkflowStepResult): boolean {
    return step.status !== 'NOT_RUN' && !this.collapsed.has(step.index);
  }

  toggle(step: WorkflowStepResult): void {
    if (this.collapsed.has(step.index)) {
      this.collapsed.delete(step.index);
    } else {
      this.collapsed.add(step.index);
    }
  }

  entries(values: Record<string, unknown> | undefined): { name: string; value: string }[] {
    return Object.entries(values ?? {}).map(([name, value]) => ({ name, value: this.json(value) }));
  }

  json(value: unknown): string {
    return JSON.stringify(value) ?? 'null';
  }

  runAgain(run: WorkflowResult): void {
    openRunDialog(this.modals, run.documentId, [run.workflowId], run.workflowId);
  }
}
