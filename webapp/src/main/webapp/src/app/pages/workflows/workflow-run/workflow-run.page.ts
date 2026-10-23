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
import { catchError, map, shareReplay, switchMap, takeWhile, tap } from 'rxjs/operators';

import { BsModalService } from 'ngx-bootstrap/modal';
import { HighlightAuto } from 'ngx-highlightjs';

import {
  ArazzoStepExpectation,
  WorkflowCriterionResult,
  WorkflowExampleCheck,
  WorkflowResult,
  WorkflowSessionCall,
  WorkflowStepResult
} from '../../../models/arazzo-run.model';
import { RequestResponsePair } from '../../../models/service.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { TimeAgoPipe } from '../../../components/time-ago.pipe';
import { openRunDialog } from '../workflow-run-dialog/workflow-run.dialog';
import { WorkflowRunCoherenceComponent } from '../workflow-run-coherence/workflow-run-coherence.component';

/** How often a run in progress is read again, in milliseconds. */
export const POLLING_INTERVAL = 2000;

/** The run read from the API, or null when it does not exist. */
type RunState = { run: WorkflowResult | null };

/**
 * Why a run failed: at a step, with its unmet criteria or its message, or before any step tells it; attempts tells how
 * many times the step was called, more than once when it was retried.
 */
export type RunFailure = {
  step?: WorkflowStepResult;
  unmet: WorkflowCriterionResult[];
  message?: string;
  attempts: number;
};

/** An output a recorded example expects, next to the one the run produced; unmet when they differ. */
export type ExpectedOutput = { name: string; expected: string; got: string; unmet: boolean };

/** Which attempt of a retried step a slot of the run is, from 1, out of how many, and whether a later one followed. */
export type StepAttempt = { attempt: number; attempts: number; retried: boolean };

/** The request and response a step exchanged, as stored; absent when the step sent nothing. */
export type StepExchange = { pair?: RequestResponsePair };

/** The page of a run of a workflow: its status, then its steps in the order they were executed. */
@Component({
  selector: 'app-workflow-run-page',
  templateUrl: './workflow-run.page.html',
  styleUrls: ['./workflow-run.page.css'],
  imports: [CommonModule, RouterLink, TimeAgoPipe, HighlightAuto, WorkflowRunCoherenceComponent]
})
export class WorkflowRunPageComponent implements OnInit {

  readonly availableSoon = 'Available soon';
  readonly hlLang: string[] = ['json', 'xml', 'yaml'];

  state!: Observable<RunState>;
  /** The steps the API developer expanded or collapsed, by index: the failing step comes expanded, the others not. */
  toggled = new Set<number>();
  /** The exchange of each step, by testCaseId, read once. */
  private exchanges = new Map<string, Observable<StepExchange>>();

  constructor(private runSvc: ArazzoRunService, private route: ActivatedRoute, private modals: BsModalService) {
  }

  ngOnInit(): void {
    // A run in progress is read again until it is final, so that the page follows it without reload.
    this.state = this.route.paramMap.pipe(
      // The page is kept from one run to another: each run opens with its own steps expanded.
      tap(() => this.toggled.clear()),
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

  /** Whether the result is the verification of the calls an application made to the mocks in a session. */
  isSession(run: WorkflowResult): boolean {
    return run.origin === 'SESSION';
  }

  /** The failed steps of a verification: its calls do not stop at a failure, so each failed step tells why. */
  failedSteps(run: WorkflowResult): WorkflowStepResult[] {
    return run.steps.filter(step => step.status === 'FAILED');
  }

  /** The calls of a verification that no remaining step of the workflow expected: each one tells why it fails. */
  unexpectedCalls(run: WorkflowResult): WorkflowSessionCall[] {
    return run.session?.calls.filter(call => call.failure) ?? [];
  }

  /** The call a session received for a step of its verification; null for a run, or a step that received none. */
  callOf(run: WorkflowResult, step: WorkflowStepResult): WorkflowSessionCall | null {
    return run.session?.calls.find(call => call.stepId === step.stepId) ?? null;
  }

  /** When the run started, for the time-ago pipe. */
  startedOn(run: WorkflowResult): string {
    return new Date(run.startedDate).toISOString();
  }

  /**
   * Why the run failed; null when it did not. A run fails at its last failed slot: the attempts of a retried step
   * before it failed too.
   */
  failure(run: WorkflowResult): RunFailure | null {
    if (run.status !== 'FAILURE') {
      return null;
    }
    const step = [...run.steps].reverse().find(candidate => candidate.status === 'FAILED');
    if (!step) {
      return { unmet: [], message: run.message, attempts: 0 };
    }
    return { step, unmet: step.criteria.filter(criterion => !criterion.held), message: step.message,
      attempts: this.attemptsOf(run, step).length };
  }

  /** The attempt a slot is of a step called several times, as a retry action says; null for a step called once. */
  attemptOf(run: WorkflowResult, step: WorkflowStepResult): StepAttempt | null {
    const attempts = this.attemptsOf(run, step);
    if (attempts.length < 2) {
      return null;
    }
    const attempt = attempts.indexOf(step) + 1;
    return { attempt, attempts: attempts.length, retried: attempt < attempts.length };
  }

  /** The slots where a step ran: one per call, in execution order. */
  private attemptsOf(run: WorkflowResult, step: WorkflowStepResult): WorkflowStepResult[] {
    return run.steps.filter(slot => slot.stepId === step.stepId && slot.status !== 'NOT_RUN');
  }

  /** What the unmet criteria saw: "the response status was 400", or the value of each expression. */
  evaluated(unmet: WorkflowCriterionResult[]): string {
    return unmet.flatMap(criterion => criterion.values).map(value => value.expression === '$statusCode'
      ? 'the response status was ' + value.value : value.expression + ' was ' + this.json(value.value)).join(', ');
  }

  /** The step the run failed at comes expanded, the attempts of a retried step before it do not. */
  isExpanded(step: WorkflowStepResult, run: WorkflowResult): boolean {
    const failedThere = step.status === 'FAILED' && !this.attemptOf(run, step)?.retried;
    return step.status !== 'NOT_RUN' && failedThere !== this.toggled.has(step.index);
  }

  toggle(step: WorkflowStepResult): void {
    if (this.toggled.has(step.index)) {
      this.toggled.delete(step.index);
    } else {
      this.toggled.add(step.index);
    }
  }

  /** The request and response of a step, stored under its testCaseId as those of tests. */
  exchange(run: WorkflowResult, step: WorkflowStepResult): Observable<StepExchange> {
    const testCaseId = step.testCaseId;
    if (!testCaseId) {
      return of({});
    }
    if (!this.exchanges.has(testCaseId)) {
      this.exchanges.set(testCaseId, this.runSvc.getExchanges(run.id, testCaseId).pipe(
        map(pairs => ({ pair: pairs[0] })),
        catchError(() => of({})),
        shareReplay(1)
      ));
    }
    return this.exchanges.get(testCaseId)!;
  }

  /** The W3C baggage a step sent, which marks its call to the mocks in Live Traces; null when it sent none. */
  baggageOf(exchange: StepExchange): string | null {
    const headers = exchange.pair?.request?.headers ?? [];
    const baggage = headers.filter(header => header.name.toLowerCase() === 'baggage').flatMap(header => header.values);
    return baggage.length ? baggage.join(',') : null;
  }

  /** Where a step sent its request, relative to Microcks whose mocks the run targets. */
  requestTarget(step: WorkflowStepResult): string {
    const url = new URL(step.requestUrl!);
    return url.pathname + url.search;
  }

  /** The value of a parameter as it was sent: text as is, anything else as JSON. */
  sent(value: unknown): string {
    return typeof value === 'string' ? value : this.json(value);
  }

  /** The outputs of a step, each with the runtime expression it came from when the minion tells it. */
  outputsOf(step: WorkflowStepResult): { name: string; value: string; origin?: string }[] {
    return this.entries(step.outputs).map(output => ({ ...output, origin: step.outputOrigins?.[output.name] }));
  }

  entries(values: Record<string, unknown> | undefined): { name: string; value: string }[] {
    return Object.entries(values ?? {}).map(([name, value]) => ({ name, value: this.json(value) }));
  }

  json(value: unknown): string {
    return JSON.stringify(value) ?? 'null';
  }

  /** Running a run again plays the same example, if it played one. */
  runAgain(run: WorkflowResult): void {
    openRunDialog(this.modals, run.documentId, [run.workflowId], run.workflowId, run.example?.name);
  }

  /** Whether the run matches the example it played, once it ended. */
  verdictLabel(example: WorkflowExampleCheck): string {
    switch (example.verdict) {
      case 'MATCHES': return 'Matches';
      case 'DOES_NOT_MATCH': return 'Does not match';
      default: return 'Judged once the run ends';
    }
  }

  /** Each output the example expects, with the output the run produced: unmet when the judge says so. */
  expectedOutputs(run: WorkflowResult): ExpectedOutput[] {
    const example = run.example!;
    const produced = run.outputs ?? {};
    return Object.entries(example.outputs).map(([name, value]) => ({
      name,
      expected: this.json(value),
      got: name in produced ? this.json(produced[name]) : 'absent',
      unmet: example.unmetExpectations.some(unmet => unmet.startsWith('Output ' + name + ':'))
    }));
  }

  /** What an example expects of a step: its exact status, when it gives one. */
  expectedStatus(step: ArazzoStepExpectation): string {
    return step.status == null ? '' : ' ' + step.status;
  }
}
