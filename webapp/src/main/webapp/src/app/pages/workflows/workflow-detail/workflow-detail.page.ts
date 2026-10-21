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
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';

import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import {
  ArazzoDataPassing,
  ArazzoExpressionUse,
  ArazzoSourceLink,
  ArazzoStepDetail,
  ArazzoWorkflowDetail,
  ArazzoWorkflowInput
} from '../../../models/arazzo-workflow.model';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';

/** The workflow read from the API, or null when it does not exist. */
type WorkflowState = { workflow: ArazzoWorkflowDetail | null };

@Component({
  selector: 'app-workflow-detail-page',
  templateUrl: './workflow-detail.page.html',
  styleUrls: ['./workflow-detail.page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink
  ]
})
export class WorkflowDetailPageComponent implements OnInit {

  readonly availableSoon = 'Available soon';

  state!: Observable<WorkflowState>;

  constructor(private workflowSvc: ArazzoWorkflowService, private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    this.state = this.route.paramMap.pipe(
      switchMap((params: ParamMap) =>
        this.workflowSvc.getWorkflow(params.get('documentId')!, params.get('workflowId')!).pipe(
          map(workflow => ({ workflow } as WorkflowState)),
          catchError(() => of({ workflow: null } as WorkflowState))
        ))
    );
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
  inputUses(input: ArazzoWorkflowInput): string[] {
    const byStep = new Map<string, string[]>();
    input.usedBy.forEach(use => {
      const places = byStep.get(use.stepId) ?? [];
      places.push(this.place(use));
      byStep.set(use.stepId, places);
    });
    return Array.from(byStep.entries()).map(([stepId, places]) => stepId + ' · ' + places.join(', '));
  }

  /** Why a source description is not linked, when it is not. */
  sourceProblem(source: ArazzoSourceLink): string | null {
    if (source.linked) {
      return null;
    }
    return source.apiName ? 'not found in Microcks' : 'No API name and version for this source';
  }

  entries(expressions: Record<string, string>): { name: string; expression: string }[] {
    return Object.entries(expressions).map(([name, expression]) => ({ name, expression }));
  }

  private place(use: ArazzoExpressionUse): string {
    return use.target ? use.place + ' ' + use.target : use.place;
  }
}
