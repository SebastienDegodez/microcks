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

import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import {
  ArazzoDataPassing,
  ArazzoExpressionUse,
  ArazzoStepDetail,
  ArazzoWorkflowDetail,
  ArazzoWorkflowInput
} from '../../../models/arazzo-workflow.model';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { openRunDialog } from '../workflow-run-dialog/workflow-run.dialog';
import { TimeAgoPipe } from '../../../components/time-ago.pipe';
import { WorkflowDiagramComponent } from './workflow-diagram/workflow-diagram.component';

/** The steps as cards, or the workflow as a diagram; the URL keeps it as ?view=diagram so a link can be shared. */
export type WorkflowView = 'steps' | 'diagram';

/** The workflow read from the API, or null when it does not exist, and the view it is shown in. */
type WorkflowState = { workflow: ArazzoWorkflowDetail | null; view: WorkflowView };

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

  readonly availableSoon = 'Available soon';

  state!: Observable<WorkflowState>;

  constructor(private workflowSvc: ArazzoWorkflowService, private route: ActivatedRoute, private router: Router,
              private host: ElementRef<HTMLElement>, private injector: Injector, private modalService: BsModalService) {
  }

  ngOnInit(): void {
    const workflow = this.route.paramMap.pipe(
      switchMap((params: ParamMap) =>
        this.workflowSvc.getWorkflow(params.get('documentId')!, params.get('workflowId')!).pipe(
          catchError(() => of(null))
        ))
    );
    const view = this.route.queryParamMap.pipe(
      map(params => (params.get('view') === 'diagram' ? 'diagram' : 'steps') as WorkflowView)
    );
    this.state = combineLatest([workflow, view]).pipe(map(([workflow, view]) => ({ workflow, view })));
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
