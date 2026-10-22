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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  QueryList,
  ViewChildren
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { ArazzoStepDetail, ArazzoWorkflowDetail } from '../../../../models/arazzo-workflow.model';
import { DiagramEdge, DiagramNode, WorkflowDiagram, layoutWorkflowDiagram } from './workflow-diagram.layout';
import { StepActionLine, stepActionLines } from '../step-actions';
import { stepEndpoint, stepMessagingSummary } from '../step-messaging';

/**
 * A read-only, top-down diagram of an Arazzo workflow: its inputs, its steps and its outputs chained by sequence
 * edges, the values given to each step drawn as labelled data edges, and the actions of the steps drawn next to them:
 * a loop for a retry, an exit for an end. The layout comes from
 * {@link layoutWorkflowDiagram}; once the nodes are rendered, their measured heights are given back to it so the
 * edges meet nodes whose text wrapped on more lines than estimated.
 */
@Component({
  selector: 'app-workflow-diagram',
  templateUrl: './workflow-diagram.component.html',
  styleUrls: ['./workflow-diagram.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class WorkflowDiagramComponent implements AfterViewInit, OnDestroy {

  /** Emits the id of a step clicked, or chosen with Enter, in the diagram. */
  @Output() stepSelected = new EventEmitter<string>();

  @ViewChildren('nodeElement') nodeElements!: QueryList<ElementRef<HTMLElement>>;

  diagram!: WorkflowDiagram;

  private current!: ArazzoWorkflowDetail;
  private observer?: ResizeObserver;
  private stepActions = new WeakMap<ArazzoStepDetail, StepActionLine[]>();
  private nodesChanges?: Subscription;

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) {
  }

  @Input({ required: true }) set workflow(workflow: ArazzoWorkflowDetail) {
    this.current = workflow;
    this.diagram = layoutWorkflowDiagram(workflow);
  }

  get workflow(): ArazzoWorkflowDetail {
    return this.current;
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    this.observer = new ResizeObserver(() => this.zone.run(() => this.relayout()));
    this.nodesChanges = this.nodeElements.changes.pipe(startWith(null)).subscribe(() => {
      this.observer!.disconnect();
      this.nodeElements.forEach(element => this.observer!.observe(element.nativeElement));
    });
  }

  ngOnDestroy(): void {
    this.nodesChanges?.unsubscribe();
    this.observer?.disconnect();
  }

  select(node: DiagramNode): void {
    if (node.step) {
      this.stepSelected.emit(node.step.stepId);
    }
  }

  /** The success criteria of a step on one compact line. */
  criteriaOf(step: ArazzoStepDetail): string {
    return step.successCriteria.map(criterion => criterion.condition).join(' · ');
  }

  /** Where a step of an AsyncAPI source sends or receives: "RECEIVE orders/confirmed". */
  endpointOf(step: ArazzoStepDetail): string {
    return stepEndpoint(step);
  }

  /** The message a receive step waits for, and for how long, on one compact line; empty when it tells neither. */
  messagingOf(step: ArazzoStepDetail): string {
    return stepMessagingSummary(step);
  }

  /** What a step does on success and on failure, one line each, read once per step. */
  actionLines(step: ArazzoStepDetail): StepActionLine[] {
    if (!this.stepActions.has(step)) {
      this.stepActions.set(step, stepActionLines(step));
    }
    return this.stepActions.get(step)!;
  }

  outputsOf(workflow: ArazzoWorkflowDetail): { name: string; expression: string }[] {
    return Object.entries(workflow.outputs).map(([name, expression]) => ({ name, expression }));
  }

  trackNode(_index: number, node: DiagramNode): string {
    return node.id;
  }

  trackEdge(_index: number, edge: DiagramEdge): string {
    return edge.kind + edge.from + edge.to + (edge.label?.lines[0] ?? '');
  }

  /** Lays the diagram out again with the heights the nodes have once rendered, when they differ from the layout. */
  private relayout(): void {
    const heights: Record<string, number> = {};
    this.nodeElements.forEach(element => heights[element.nativeElement.dataset['nodeId']!] = element.nativeElement.offsetHeight);
    const rendered = this.diagram.nodes.every(node => heights[node.id] > 0);
    if (rendered && this.diagram.nodes.some(node => heights[node.id] !== node.height)) {
      this.diagram = layoutWorkflowDiagram(this.current, heights);
      this.cdr.markForCheck();
    }
  }
}
