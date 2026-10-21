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
import { DiagramBox, DiagramNode, WorkflowDiagram, layoutWorkflowDiagram } from './workflow-diagram.layout';

/** The workflow readThenReprice: two steps, two inputs, one step output passed to the next step, two outputs. */
function readThenReprice(): ArazzoWorkflowDetail {
  return {
    documentId: 'doc-1',
    title: 'API Pastry scenarios',
    version: '1.0.0',
    arazzoVersion: '1.0.1',
    importDate: 0,
    workflowIds: ['readThenReprice'],
    sources: [],
    workflowId: 'readThenReprice',
    inputs: [
      { name: 'pastry', usedBy: [{ stepId: 'readPastry', place: 'path', target: 'name' }] },
      { name: 'newPrice', usedBy: [{ stepId: 'reprice', place: 'body', target: '/price' },
          { stepId: 'reprice', place: 'criterion' }] }
    ],
    steps: [
      {
        stepId: 'readPastry',
        operation: { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET', path: '/pastry/{name}' },
        parameters: [{ name: 'name', in: 'path', value: '$inputs.pastry' }],
        successCriteria: [{ condition: '$statusCode == 200 && $response.body#/status == \'available\'', type: 'simple' }],
        outputs: { name: '$response.body#/name', price: '$response.body#/price' }
      },
      {
        stepId: 'reprice',
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' },
        parameters: [{ name: 'name', in: 'path', value: '$steps.readPastry.outputs.name' }],
        successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
        outputs: { price: '$response.body#/price' }
      }
    ],
    outputs: { before: '$steps.readPastry.outputs.price', after: '$steps.reprice.outputs.price' },
    dataPassings: [{ fromStepId: 'readPastry', outputName: 'name', to: { stepId: 'reprice', place: 'path', target: 'name' } }]
  };
}

function node(diagram: WorkflowDiagram, id: string): DiagramNode {
  return diagram.nodes.find(candidate => candidate.id === id)!;
}

function overlap(a: DiagramBox, b: DiagramBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(box: DiagramBox, diagram: WorkflowDiagram): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= diagram.width && box.y + box.height <= diagram.height;
}

describe('layoutWorkflowDiagram', () => {

  it('places the inputs, each step in order, then the outputs, top to bottom in one column', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());

    expect(diagram.nodes.map(each => each.id)).toEqual(['inputs', 'step:readPastry', 'step:reprice', 'outputs']);
    expect(diagram.nodes.map(each => each.kind)).toEqual(['inputs', 'step', 'step', 'outputs']);
    expect(diagram.nodes.map(each => each.step?.stepId)).toEqual([undefined, 'readPastry', 'reprice', undefined]);
    expect(diagram.nodes.map(each => each.index)).toEqual([undefined, 0, 1, undefined]);
    diagram.nodes.slice(1).forEach((each, i) => {
      const above = diagram.nodes[i];
      expect(each.x).toEqual(above.x);
      expect(each.width).toEqual(above.width);
      expect(each.y).toBeGreaterThan(above.y + above.height);
    });
  });

  it('leaves every node without a run status', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());

    expect(diagram.nodes.map(each => each.status)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('links the inputs to the first step, each step to the next and the last step to the outputs', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());

    expect(diagram.edges.filter(edge => edge.kind === 'sequence').map(edge => edge.from + ' -> ' + edge.to)).toEqual([
      'inputs -> step:readPastry',
      'step:readPastry -> step:reprice',
      'step:reprice -> outputs'
    ]);
  });

  it('links the inputs straight to the outputs of a workflow without step', () => {
    const workflow = readThenReprice();
    workflow.steps = [];
    workflow.inputs = [];
    workflow.dataPassings = [];

    const diagram = layoutWorkflowDiagram(workflow);

    expect(diagram.nodes.map(each => each.id)).toEqual(['inputs', 'outputs']);
    expect(diagram.edges.map(edge => edge.kind + ' ' + edge.from + ' -> ' + edge.to))
      .toEqual(['sequence inputs -> outputs']);
  });

  it('draws a sequence edge from the bottom middle of a node to the top middle of the next one', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());
    const readPastry = node(diagram, 'step:readPastry');
    const reprice = node(diagram, 'step:reprice');
    const middle = readPastry.x + readPastry.width / 2;

    const edge = diagram.edges.find(each => each.kind === 'sequence' && each.from === 'step:readPastry')!;

    expect(edge.path).toEqual(`M ${middle} ${readPastry.y + readPastry.height} L ${middle} ${reprice.y}`);
  });

  it('draws one labelled data edge per value given to a step: inputs on the left, step outputs on the right', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());

    expect(diagram.edges.filter(edge => edge.kind === 'data')
      .map(edge => ({ from: edge.from, to: edge.to, side: edge.side, lines: edge.label?.lines }))).toEqual([
      { from: 'inputs', to: 'step:readPastry', side: 'left', lines: ['$inputs.pastry', '→ path name'] },
      { from: 'inputs', to: 'step:reprice', side: 'left', lines: ['$inputs.newPrice', '→ body /price', '→ criterion'] },
      { from: 'step:readPastry', to: 'step:reprice', side: 'right', lines: ['outputs.name', '→ path name'] }
    ]);
  });

  it('names the query and header parameters a value goes to', () => {
    const workflow = readThenReprice();
    workflow.inputs = [{ name: 'pastry', usedBy: [{ stepId: 'readPastry', place: 'query', target: 'q' },
        { stepId: 'readPastry', place: 'header', target: 'X-Pastry' }] }];
    workflow.dataPassings = [];

    const diagram = layoutWorkflowDiagram(workflow);

    expect(diagram.edges.filter(edge => edge.kind === 'data').map(edge => edge.label?.lines))
      .toEqual([['$inputs.pastry', '→ query q', '→ header X-Pastry']]);
  });

  it('starts a data edge on the side of its source and ends it on the same side of its target', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());
    const inputs = node(diagram, 'inputs');
    const readPastry = node(diagram, 'step:readPastry');
    const reprice = node(diagram, 'step:reprice');
    const left = inputs.x;
    const right = inputs.x + inputs.width;

    const edges = diagram.edges.filter(edge => edge.kind === 'data');
    const start = (path: string) => path.split(' ').slice(1, 3).map(Number);
    const end = (path: string) => path.split(' ').slice(-2).map(Number);

    expect(start(edges[0].path)[0]).toEqual(left);
    expect(end(edges[0].path)[0]).toEqual(left);
    expect(start(edges[0].path)[1]).toBeGreaterThan(inputs.y);
    expect(start(edges[0].path)[1]).toBeLessThanOrEqual(inputs.y + inputs.height);
    expect(end(edges[0].path)[1]).toBeGreaterThan(readPastry.y);
    expect(end(edges[0].path)[1]).toBeLessThan(readPastry.y + readPastry.height);
    expect(end(edges[1].path)[1]).toBeGreaterThan(reprice.y);
    expect(start(edges[2].path)[0]).toEqual(right);
    expect(end(edges[2].path)[0]).toEqual(right);
  });

  it('keeps every label inside the diagram, off the nodes and off the other labels', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());
    const labels = diagram.edges.filter(edge => edge.label).map(edge => edge.label!);

    expect(labels.length).toEqual(3);
    labels.forEach(label => {
      expect(inside(label, diagram)).withContext(label.lines.join(' ')).toBeTrue();
      diagram.nodes.forEach(each => expect(overlap(label, each)).withContext(label.lines[0] + ' / ' + each.id).toBeFalse());
    });
    labels.forEach((label, i) => labels.slice(i + 1)
      .forEach(other => expect(overlap(label, other)).withContext(label.lines[0] + ' / ' + other.lines[0]).toBeFalse()));
    diagram.nodes.forEach(each => expect(inside(each, diagram)).withContext(each.id).toBeTrue());
  });

  it('anchors a left label on its right edge and a right label on its left edge, next to their curve', () => {
    const diagram = layoutWorkflowDiagram(readThenReprice());
    const [leftEdge, , rightEdge] = diagram.edges.filter(edge => edge.kind === 'data');

    expect(leftEdge.label!.align).toEqual('end');
    expect(leftEdge.label!.x + leftEdge.label!.width).toBeLessThan(node(diagram, 'inputs').x);
    expect(rightEdge.label!.align).toEqual('start');
    expect(rightEdge.label!.x).toBeGreaterThan(node(diagram, 'inputs').x + node(diagram, 'inputs').width);
  });

  it('wraps a long label line rather than widening the diagram without bound', () => {
    const workflow = readThenReprice();
    workflow.inputs[0].name = 'aVeryLongInputNameThatWouldNeverFitOnOneLineOfALabel';

    const diagram = layoutWorkflowDiagram(workflow);
    const label = diagram.edges.find(edge => edge.kind === 'data')!.label!;

    expect(label.lines.length).toBeGreaterThan(2);
    expect(label.lines.join('')).toEqual('$inputs.aVeryLongInputNameThatWouldNeverFitOnOneLineOfALabel→ path name');
    expect(Math.max(...label.lines.map(line => line.length))).toBeLessThanOrEqual(28);
  });

  it('gives a node the height it was measured at and moves the nodes below it down', () => {
    const estimated = layoutWorkflowDiagram(readThenReprice());

    const measured = layoutWorkflowDiagram(readThenReprice(), { 'step:readPastry': 400 });

    expect(node(measured, 'step:readPastry').height).toEqual(400);
    expect(node(measured, 'step:reprice').y - node(estimated, 'step:reprice').y)
      .toEqual(400 - node(estimated, 'step:readPastry').height);
    expect(measured.height - estimated.height).toEqual(400 - node(estimated, 'step:readPastry').height);
  });

  it('makes a step node taller when its endpoint, operation or criteria need more lines', () => {
    const short = layoutWorkflowDiagram(readThenReprice());
    const workflow = readThenReprice();
    workflow.steps[1].successCriteria.push({ condition: '$response.body#/price == $inputs.newPrice && '
        + '$response.body#/name == $steps.readPastry.outputs.name', type: 'simple' });

    const long = layoutWorkflowDiagram(workflow);

    expect(node(long, 'step:reprice').height).toBeGreaterThan(node(short, 'step:reprice').height);
    expect(node(long, 'step:readPastry').height).toEqual(node(short, 'step:readPastry').height);
  });
});
