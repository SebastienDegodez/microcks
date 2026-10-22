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
import { ArazzoExpressionUse, ArazzoStepDetail, ArazzoWorkflowDetail } from '../../../../models/arazzo-workflow.model';
import { stepActionLines } from '../step-actions';
import { stepEndpoint, stepMessagingSummary } from '../step-messaging';

/** A rectangle of the diagram, in pixels from its top left corner. */
export type DiagramBox = { x: number; y: number; width: number; height: number };

/** The result of a step in a run. Reserved for the runs to come: the diagram does not show it yet. */
export type DiagramNodeStatus = 'passed' | 'failed' | 'skipped';

/** The inputs, a step or the outputs of the workflow; a step node carries the step and its position (from 0). */
export type DiagramNode = DiagramBox & {
  id: string;
  kind: 'inputs' | 'step' | 'outputs';
  step?: ArazzoStepDetail;
  index?: number;
  status?: DiagramNodeStatus;
};

/** What a data edge carries, one line per text line; 'end' aligns the lines on the right edge of the box. */
export type DiagramLabel = DiagramBox & { lines: string[]; align: 'start' | 'end' };

/**
 * A sequence edge goes from a node to the next one, or from a step to a step that must come after it when steps declare
 * dependsOn; a data edge brings a value to a step, on one side; a retry edge
 * loops on the step it calls again; an end edge leaves the step whose action ends the workflow.
 */
export type DiagramEdge = {
  kind: 'sequence' | 'data' | 'retry' | 'end';
  from: string;
  to: string;
  side?: 'left' | 'right';
  path: string;
  label?: DiagramLabel;
};

export type WorkflowDiagram = { width: number; height: number; nodes: DiagramNode[]; edges: DiagramEdge[] };

const MARGIN = 16;
const NODE_WIDTH = 300;
/** The width left for text inside a node: its width less its border and padding. */
const NODE_TEXT_WIDTH = NODE_WIDTH - 2 * 2 - 2 * 12;
const NODE_GAP = 56;
const NODE_PADDING = 2 * 2 + 2 * 10;

/** Approximate character widths: monospace is 0.6em, Open Sans a bit less; a measured height replaces the estimate. */
const MONO_12 = 7.3;
const MONO_11 = 6.7;
const SANS_13 = 7.4;

const LANE_FIRST = 28;
const LANE_STEP = 28;
const EXIT_ABOVE_BOTTOM = 12;
const ENTRY_BELOW_TOP = 18;
const ENTRY_STEP = 10;

/** How far a retry loop and an end exit reach out of the right side of their step. */
const ACTION_REACH = 24;
/** The space between two end exits of a step, and between the lowest one and the bottom of the step. */
const EXIT_STEP = 24;
const EXIT_ABOVE_BOTTOM_ACTION = 30;
const LOOP_HEIGHT = 26;

const LABEL_MAX_CHARS = 28;
const LABEL_GAP = 6;
const LABEL_LINE = 16;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 3;

/**
 * Lays the workflow out as a top-down flow chart.
 *
 * When every step comes after all the steps listed before it, as in a workflow without dependsOn, the inputs, each
 * step in order, then the outputs stand in one column linked by sequence edges. Each value given to a step is a data
 * edge curving on a side of the column: values of the workflow inputs on the left, step outputs on the right, each
 * with a label telling where the value goes. The actions of a step sit right next to it, on the right: a loop for a
 * retry, a short exit for each action ending the workflow, each labelled; the data edges of the right side then curve
 * beyond them.
 *
 * When a step declares dependsOn (Arazzo 1.1) and comes after fewer steps, see {@link layoutDependencies}.
 *
 * Node heights are estimated from their text; the heights measured once rendered (by node id) replace them.
 */
export function layoutWorkflowDiagram(workflow: ArazzoWorkflowDetail,
                                      measuredHeights: Record<string, number> = {}): WorkflowDiagram {
  if (dependsOnRelaxesTheOrder(workflow)) {
    return layoutDependencies(workflow, measuredHeights);
  }
  const nodes = placeNodes(workflow, measuredHeights);
  const flows = dataFlows(workflow, nodes);
  const left = sideExtent(flows.filter(flow => flow.side === 'left'), 0);
  nodes.forEach(node => node.x = MARGIN + left);
  const actions = actionEdges(nodes);
  const actionsExtent = Math.max(0, ...actions.map(edge => edge.label!.x + edge.label!.width - nodeRight(nodes)));
  // Data edges on the right curve beyond the actions: their apex, at 3/4 of their lane, clears the action labels.
  const shift = actionsExtent ? Math.ceil(actionsExtent * 4 / 3) : 0;
  const right = Math.max(actionsExtent, sideExtent(flows.filter(flow => flow.side === 'right'), shift));

  const edges = [...sequenceEdges(nodes), ...actions, ...dataEdges(flows, nodes, shift)];
  const bottoms = [...nodes, ...edges.filter(edge => edge.label).map(edge => edge.label!)]
    .map(box => box.y + box.height);
  return {
    width: MARGIN + left + NODE_WIDTH + right + MARGIN,
    height: Math.max(...bottoms) + MARGIN,
    nodes,
    edges
  };
}

function placeNodes(workflow: ArazzoWorkflowDetail, measuredHeights: Record<string, number>): DiagramNode[] {
  const nodes: DiagramNode[] = [
    { id: 'inputs', kind: 'inputs', x: 0, y: 0, width: NODE_WIDTH, height: inputsHeight(workflow) },
    ...workflow.steps.map((step, index) => ({ id: 'step:' + step.stepId, kind: 'step' as const, step, index,
      x: 0, y: 0, width: NODE_WIDTH, height: stepHeight(step) })),
    { id: 'outputs', kind: 'outputs', x: 0, y: 0, width: NODE_WIDTH, height: outputsHeight(workflow) }
  ];
  let y = MARGIN;
  nodes.forEach(node => {
    node.height = measuredHeights[node.id] ?? node.height;
    node.y = y;
    y += node.height + NODE_GAP;
  });
  return nodes;
}

function linesOf(text: string, charWidth: number, width = NODE_TEXT_WIDTH): number {
  return Math.max(1, Math.ceil(text.length * charWidth / width));
}

function inputsHeight(workflow: ArazzoWorkflowDetail): number {
  const chips = workflow.inputs.map(input => input.name + '   ').join('');
  return NODE_PADDING + 22 + 22 * linesOf(chips || 'No input', MONO_12);
}

function outputsHeight(workflow: ArazzoWorkflowDetail): number {
  const outputs = Object.entries(workflow.outputs).map(([name, expression]) => name + ' ← ' + expression);
  return NODE_PADDING + 22 + (outputs.length ? outputs : ['No output'])
    .reduce((height, output) => height + 4 + 18 * linesOf(output, MONO_12), 0);
}

function stepHeight(step: ArazzoStepDetail): number {
  const operation = step.operation;
  const endpointText = step.messaging ? 'EVENT  ' + stepEndpoint(step) : 'REST  ' + operation.method + ' ' + operation.path;
  const endpoint = operation.reason ? 0 : 20 * linesOf(endpointText, MONO_12);
  // A step on a channel found in its AsyncAPI contract names no operation.
  const operationText = (operation.operationId || operation.channel) + (operation.reason ? '  ' + operation.reason : '');
  const operationId = operation.operationId || operation.reason ? 20 * linesOf(operationText, SANS_13) : 0;
  const messaging = stepMessagingSummary(step);
  const criteria = step.successCriteria.map(criterion => criterion.condition).join(' · ');
  const actions = stepActionLines(step).reduce((height, line) => height + 4 + 18 * linesOf('↻ ' + line.summary, SANS_13), 0);
  return NODE_PADDING + 28 + endpoint + operationId + (messaging ? 4 + 16 * linesOf('✉ ' + messaging, MONO_11) : 0)
    + (criteria ? 6 + 16 * linesOf('✓ ' + criteria, MONO_11) : 0) + actions;
}

function nodeRight(nodes: DiagramNode[]): number {
  return nodes[0].x + nodes[0].width;
}

/**
 * A retry loop leaves the right side of its step and comes back into it higher, as the step is called again; each
 * action ending the workflow leaves it below the loop, success first, in a short labelled exit.
 */
function actionEdges(nodes: DiagramNode[]): DiagramEdge[] {
  const edges: DiagramEdge[] = [];
  nodes.filter(node => node.step).forEach(node => {
    const step = node.step!;
    const right = node.x + node.width;
    const exits = stepActionLines(step).filter(line => line.action.type === 'end');
    const lowest = node.y + node.height - EXIT_ABOVE_BOTTOM_ACTION;
    exits.forEach((line, k) => {
      const y = Math.round(lowest - (exits.length - 1 - k) * EXIT_STEP);
      const label = actionLabel(['end on ' + line.outcome], right + ACTION_REACH, y);
      edges.push({ kind: 'end', from: node.id, to: 'end:' + step.stepId + ':' + line.outcome + ':' + line.position,
        path: `M ${right} ${y} L ${right + ACTION_REACH} ${y}`, label });
    });
    const retry = stepActionLines(step).find(line => line.action.type === 'retry');
    if (retry) {
      const startY = Math.round(lowest - exits.length * EXIT_STEP + (exits.length ? 10 : 0));
      const endY = startY - LOOP_HEIGHT;
      const control = right + Math.ceil(ACTION_REACH * 4 / 3);
      const action = retry.action;
      const label = actionLabel(['retry ×' + action.retryLimit + (action.retryAfter ? ' · ' + action.retryAfter + ' s' : '')],
        right + ACTION_REACH, (startY + endY) / 2);
      edges.push({ kind: 'retry', from: node.id, to: node.id, label,
        path: `M ${right} ${startY} C ${control} ${startY} ${control} ${endY} ${right} ${endY}` });
    }
  });
  return edges;
}

/** The label of an action, left aligned after the end of its edge, centred on the height it is given. */
function actionLabel(lines: string[], x: number, middle: number): DiagramLabel {
  const size = labelSize(lines);
  return { lines, align: 'start', x: x + LABEL_GAP, y: Math.round(middle - size.height / 2), ...size };
}

function sequenceEdges(nodes: DiagramNode[]): DiagramEdge[] {
  // The Arazzo subset read today runs steps one after the other, retrying a step or ending the workflow early (see
  // actionEdges); goto is refused at import. Branching edges, to the step a goto goes to, would be added here.
  return nodes.slice(1).map((node, i) => {
    const above = nodes[i];
    const middle = above.x + above.width / 2;
    return { kind: 'sequence', from: above.id, to: node.id,
      path: `M ${middle} ${above.y + above.height} L ${middle} ${node.y}` };
  });
}

/** A value given to a step, before it gets a lane and a label position. */
type DataFlow = { from: string; to: string; side: 'left' | 'right'; lines: string[]; lane: number };

function dataFlows(workflow: ArazzoWorkflowDetail, nodes: DiagramNode[]): DataFlow[] {
  const flows: DataFlow[] = [];
  const add = (from: string, side: 'left' | 'right', expression: string, use: ArazzoExpressionUse) => {
    const to = 'step:' + use.stepId;
    if (!nodes.some(node => node.id === to)) {
      return;
    }
    const place = '→ ' + use.place + (use.target ? ' ' + use.target : '');
    const flow = flows.find(each => each.from === from && each.to === to && each.lines[0] === expression);
    if (flow) {
      flow.lines.push(place);
    } else {
      flows.push({ from, to, side, lines: [expression, place], lane: 0 });
    }
  };
  workflow.inputs.forEach(input => input.usedBy.forEach(use => add('inputs', 'left', '$inputs.' + input.name, use)));
  workflow.dataPassings.forEach(passing =>
    add('step:' + passing.fromStepId, 'right', 'outputs.' + passing.outputName, passing.to));

  const span = (flow: DataFlow) => Math.abs(indexOf(nodes, flow.to) - indexOf(nodes, flow.from));
  (['left', 'right'] as const).forEach(side => flows.filter(flow => flow.side === side)
    .sort((a, b) => span(a) - span(b))
    .forEach((flow, lane) => flow.lane = lane));
  flows.forEach(flow => flow.lines = flow.lines.flatMap(wrap));
  return flows;
}

function indexOf(nodes: DiagramNode[], id: string): number {
  return nodes.findIndex(node => node.id === id);
}

function wrap(line: string): string[] {
  const lines: string[] = [];
  for (let start = 0; start < line.length; start += LABEL_MAX_CHARS) {
    lines.push(line.substring(start, start + LABEL_MAX_CHARS));
  }
  return lines;
}

function laneOffset(lane: number): number {
  return LANE_FIRST + lane * LANE_STEP;
}

/** How far a curve bulges from the side of the nodes: a cubic curve reaches 3/4 of its control points. */
function bulge(lane: number, shift: number): number {
  return Math.ceil((laneOffset(lane) + shift) * 3 / 4);
}

function labelSize(lines: string[]): { width: number; height: number } {
  return {
    width: Math.ceil(Math.max(...lines.map(line => line.length)) * MONO_11) + 2 * LABEL_PADDING_X,
    height: lines.length * LABEL_LINE + 2 * LABEL_PADDING_Y
  };
}

/** The room a side takes next to the nodes: the widest bulge plus its label. */
function sideExtent(flows: DataFlow[], shift: number): number {
  return Math.max(0, ...flows.map(flow => bulge(flow.lane, shift) + LABEL_GAP + labelSize(flow.lines).width));
}

/** The data edges; those of the right side curve further out by the given shift, beyond the actions of the steps. */
function dataEdges(flows: DataFlow[], nodes: DiagramNode[], rightShift: number): DiagramEdge[] {
  const entries = new Map<string, number>();
  const edges = flows.map(flow => {
    const source = nodes[indexOf(nodes, flow.from)];
    const target = nodes[indexOf(nodes, flow.to)];
    const direction = flow.side === 'left' ? -1 : 1;
    const x = flow.side === 'left' ? source.x : source.x + source.width;
    const entry = entries.get(flow.side + flow.to) ?? 0;
    entries.set(flow.side + flow.to, entry + 1);

    const shift = flow.side === 'right' ? rightShift : 0;
    const startY = source.y + source.height - EXIT_ABOVE_BOTTOM;
    const endY = target.y + ENTRY_BELOW_TOP + entry * ENTRY_STEP;
    const laneX = x + direction * (laneOffset(flow.lane) + shift);
    const size = labelSize(flow.lines);
    const apex = x + direction * (bulge(flow.lane, shift) + LABEL_GAP);
    const label: DiagramLabel = { lines: flow.lines, align: flow.side === 'left' ? 'end' : 'start',
      x: flow.side === 'left' ? apex - size.width : apex, y: Math.round((startY + endY - size.height) / 2), ...size };
    return { kind: 'data' as const, from: flow.from, to: flow.to, side: flow.side, label,
      path: `M ${x} ${startY} C ${laneX} ${startY} ${laneX} ${endY} ${x} ${endY}` };
  });
  separateLabels(edges.map(edge => edge.label));
  return edges;
}

/** Moves a label down below the labels above it that it would cover. */
function separateLabels(labels: DiagramLabel[]): void {
  const placed: DiagramLabel[] = [];
  [...labels].sort((a, b) => a.y - b.y).forEach(label => {
    placed.filter(other => other.x < label.x + label.width && label.x < other.x + other.width)
      .forEach(other => label.y = Math.max(label.y, other.y + other.height + 4));
    placed.push(label);
  });
}

/** The room between two steps of a row, besides the room the actions of a step take on its right. */
const COLUMN_GAP = 24;

/** The steps a step must come after: those the workflow page gives, or else every step listed before it. */
function prerequisitesOf(workflow: ArazzoWorkflowDetail, index: number): string[] {
  return workflow.steps[index].prerequisites ?? workflow.steps.slice(0, index).map(step => step.stepId);
}

/**
 * Whether a step comes after fewer steps than all those listed before it, as dependsOn lets it. A step only comes after
 * steps listed before it: Microcks refuses a document whose step depends on a step listed after it.
 */
function dependsOnRelaxesTheOrder(workflow: ArazzoWorkflowDetail): boolean {
  return workflow.steps.some((_step, index) => prerequisitesOf(workflow, index).length !== index);
}

/**
 * Lays out a workflow whose steps declare dependsOn: each step stands one row below the lowest step it must come after,
 * the steps of a row side by side in the order of the list, each row centred under the inputs. A sequence edge comes to
 * a step from each step it must come after that no other of them already comes after, from the inputs to a step that
 * comes after none, and goes to the outputs from each step no step comes after. The actions of a step sit next to it,
 * as in one column, with room for them before the next step of its row. The values given to the steps are not drawn:
 * the Steps view and the Inputs panel tell where each one goes.
 */
function layoutDependencies(workflow: ArazzoWorkflowDetail, measuredHeights: Record<string, number>): WorkflowDiagram {
  const nodes = placeNodes(workflow, measuredHeights);
  const steps = nodes.filter(node => node.step);
  const prerequisites = new Map(steps.map(node =>
    [node.id, prerequisitesOf(workflow, node.index!).map(stepId => 'step:' + stepId)]));
  const rows: DiagramNode[][] = [[nodes[0]]];
  const rowOf = new Map<string, number>();
  steps.forEach(node => {
    const row = 1 + Math.max(0, ...prerequisites.get(node.id)!.map(id => rowOf.get(id) ?? 0));
    rowOf.set(node.id, row);
    rows[row] = [...(rows[row] ?? []), node];
  });
  rows.push([nodes[nodes.length - 1]]);

  steps.forEach(node => node.x = 0);
  const actionsReach = Math.max(0, ...actionEdges(steps).map(edge => edge.label!.x + edge.label!.width - NODE_WIDTH));
  const gap = COLUMN_GAP + actionsReach;
  const rowWidth = (row: DiagramNode[]) => row.length * NODE_WIDTH + (row.length - 1) * gap;
  const width = Math.max(...rows.map(rowWidth));
  let y = MARGIN;
  rows.forEach(row => {
    const left = MARGIN + (width - rowWidth(row)) / 2;
    row.forEach((node, column) => {
      node.x = left + column * (NODE_WIDTH + gap);
      node.y = y;
    });
    y += Math.max(...row.map(node => node.height)) + NODE_GAP;
  });

  const edges = [...dependencyEdges(nodes, prerequisites), ...actionEdges(nodes)];
  const boxes = [...nodes, ...edges.filter(edge => edge.label).map(edge => edge.label!)];
  return {
    width: Math.max(...boxes.map(box => box.x + box.width)) + MARGIN,
    height: Math.max(...boxes.map(box => box.y + box.height)) + MARGIN,
    nodes,
    edges
  };
}

/** The sequence edges of a workflow whose steps declare dependsOn, by step in the order of the list, then the outputs. */
function dependencyEdges(nodes: DiagramNode[], prerequisites: Map<string, string[]>): DiagramEdge[] {
  const steps = nodes.filter(node => node.step);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const reachedFrom = (id: string): Set<string> => {
    const reached = new Set<string>();
    const toFollow = [...(prerequisites.get(id) ?? [])];
    while (toFollow.length) {
      const next = toFollow.pop()!;
      if (!reached.has(next)) {
        reached.add(next);
        toFollow.push(...(prerequisites.get(next) ?? []));
      }
    }
    return reached;
  };
  const edges: DiagramEdge[] = [];
  steps.forEach(node => {
    const direct = prerequisites.get(node.id)!.filter(id => byId.has(id));
    const kept = direct.filter(id => !direct.some(other => reachedFrom(other).has(id)));
    (kept.length ? kept.map(id => byId.get(id)!) : [nodes[0]]).forEach(from => edges.push(dependencyEdge(from, node)));
  });
  steps.filter(node => !steps.some(other => prerequisites.get(other.id)!.includes(node.id)))
    .forEach(node => edges.push(dependencyEdge(node, nodes[nodes.length - 1])));
  return edges;
}

/** From the bottom middle of a node to the top middle of a node below it, bending half way above the lower one. */
function dependencyEdge(from: DiagramNode, to: DiagramNode): DiagramEdge {
  const fromX = from.x + from.width / 2;
  const toX = to.x + to.width / 2;
  const bottom = from.y + from.height;
  const bend = to.y - NODE_GAP / 2;
  const path = fromX === toX ? `M ${fromX} ${bottom} L ${toX} ${to.y}`
    : `M ${fromX} ${bottom} C ${fromX} ${bend} ${toX} ${bend} ${toX} ${to.y}`;
  return { kind: 'sequence', from: from.id, to: to.id, path };
}
