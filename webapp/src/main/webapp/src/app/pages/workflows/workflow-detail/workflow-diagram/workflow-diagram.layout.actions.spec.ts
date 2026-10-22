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
import { ArazzoWorkflowDetail } from '../../../../models/arazzo-workflow.model';
import { readUnlessPreparing, waitUntilReady } from '../../../../../test-data/order-tracking';
import { DiagramBox, DiagramEdge, DiagramNode, WorkflowDiagram, layoutWorkflowDiagram } from './workflow-diagram.layout';

function node(diagram: WorkflowDiagram, id: string): DiagramNode {
  return diagram.nodes.find(candidate => candidate.id === id)!;
}

function edges(diagram: WorkflowDiagram, kind: DiagramEdge['kind']): DiagramEdge[] {
  return diagram.edges.filter(edge => edge.kind === kind);
}

function overlap(a: DiagramBox, b: DiagramBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(box: DiagramBox, diagram: WorkflowDiagram): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= diagram.width && box.y + box.height <= diagram.height;
}

/** The numbers of an SVG path, in order: the start point, then the control and end points of its curves. */
function points(path: string): number[] {
  return path.split(/[ MLC]+/).filter(part => part).map(Number);
}

/** S17, AC-05: the diagram draws the retry loop of a step and an exit for each action ending the workflow. */
describe('layoutWorkflowDiagram of steps that retry or end the workflow', () => {

  it('draws a retry loop leaving and entering the right side of its step, labelled beside it', () => {
    const diagram = layoutWorkflowDiagram(waitUntilReady());
    const pollStatus = node(diagram, 'step:pollStatus');
    const [loop] = edges(diagram, 'retry');

    expect(edges(diagram, 'retry').length).toEqual(1);
    expect(loop.from).toEqual('step:pollStatus');
    expect(loop.to).toEqual('step:pollStatus');
    expect(loop.label?.lines).toEqual(['retry ×5 · 1 s']);
    const [startX, startY, , , , , endX, endY] = points(loop.path);
    const right = pollStatus.x + pollStatus.width;
    expect([startX, endX]).toEqual([right, right]);
    expect(startY).toBeGreaterThan(endY);
    [startY, endY].forEach(y => {
      expect(y).toBeGreaterThan(pollStatus.y);
      expect(y).toBeLessThan(pollStatus.y + pollStatus.height);
    });
    expect(loop.label!.x).toBeGreaterThan(right);
    expect(inside(loop.label!, diagram)).toBeTrue();
  });

  it('draws an exit to the right of the step for each action ending the workflow, success first', () => {
    const diagram = layoutWorkflowDiagram(readUnlessPreparing());
    const checkStatus = node(diagram, 'step:checkStatus');
    const exits = edges(diagram, 'end');

    expect(exits.map(exit => exit.from + ' ' + exit.to)).toEqual(['step:checkStatus end:checkStatus:success:0',
      'step:checkStatus end:checkStatus:failure:0']);
    expect(exits.map(exit => exit.label?.lines)).toEqual([['end on success'], ['end on failure']]);
    exits.forEach(exit => {
      const [startX, startY, endX, endY] = points(exit.path);
      expect(startX).toEqual(checkStatus.x + checkStatus.width);
      expect(endX).toBeGreaterThan(startX);
      expect(endY).toEqual(startY);
      expect(startY).toBeGreaterThan(checkStatus.y);
      expect(startY).toBeLessThan(checkStatus.y + checkStatus.height);
      expect(exit.label!.x).toBeGreaterThanOrEqual(endX);
      expect(inside(exit.label!, diagram)).toBeTrue();
    });
    expect(overlap(exits[0].label!, exits[1].label!)).toBeFalse();
  });

  it('keeps the values passed between steps clear of the actions on the right', () => {
    const workflow: ArazzoWorkflowDetail = readUnlessPreparing();
    workflow.dataPassings = [{ fromStepId: 'checkStatus', outputName: 'status',
      to: { stepId: 'readOrder', place: 'criterion' } }];
    const diagram = layoutWorkflowDiagram(workflow);
    const data = edges(diagram, 'data').find(edge => edge.side === 'right')!;

    edges(diagram, 'end').forEach(exit => expect(overlap(exit.label!, data.label!)).toBeFalse());
    expect(Math.min(...points(data.path).filter((_, i) => i % 2 === 0)))
      .toEqual(node(diagram, 'step:checkStatus').x + node(diagram, 'step:checkStatus').width);
    expect(inside(data.label!, diagram)).toBeTrue();
  });

  it('draws neither loop nor exit for steps without actions, keeping the width of the diagram', () => {
    const plain = waitUntilReady();
    plain.steps[0].onFailure = [];
    const withRetry = layoutWorkflowDiagram(waitUntilReady());
    const withoutRetry = layoutWorkflowDiagram(plain);

    expect(withoutRetry.edges.filter(edge => edge.kind === 'retry' || edge.kind === 'end')).toEqual([]);
    expect(withRetry.width).toBeGreaterThan(withoutRetry.width);
  });

  it('gives each action a line of its step, so the node is taller than without them', () => {
    const plain = waitUntilReady();
    plain.steps[0].onFailure = [];

    expect(node(layoutWorkflowDiagram(waitUntilReady()), 'step:pollStatus').height)
      .toBeGreaterThan(node(layoutWorkflowDiagram(plain), 'step:pollStatus').height);
  });
});
