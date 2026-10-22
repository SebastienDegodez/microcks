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
import { ArazzoStepDetail, ArazzoWorkflowDetail } from '../../../../models/arazzo-workflow.model';
import { tasteThenReprice } from '../../../../../test-data/pastry-tasting';
import { DiagramBox, DiagramNode, WorkflowDiagram, layoutWorkflowDiagram } from './workflow-diagram.layout';

function node(diagram: WorkflowDiagram, id: string): DiagramNode {
  return diagram.nodes.find(candidate => candidate.id === id)!;
}

function edges(diagram: WorkflowDiagram): string[] {
  return diagram.edges.filter(edge => edge.kind === 'sequence').map(edge => edge.from + ' -> ' + edge.to);
}

function overlap(a: DiagramBox, b: DiagramBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(box: DiagramBox, diagram: WorkflowDiagram): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= diagram.width && box.y + box.height <= diagram.height;
}

/** A step of the Pastry tasting demo, with the steps it declares it depends on and those it must come after. */
function step(stepId: string, dependsOn: string[] | undefined, prerequisites: string[]): ArazzoStepDetail {
  return { ...tasteThenReprice().steps[1], stepId, dependsOn, prerequisites, outputs: {} };
}

function workflowOf(steps: ArazzoStepDetail[]): ArazzoWorkflowDetail {
  return { ...tasteThenReprice(), steps, inputs: [], dataPassings: [] };
}

/**
 * S30, AC-03: when steps declare the steps they depend on (dependsOn, Arazzo 1.1), the diagram draws an edge from
 * each step a step must come after, and the steps that may be executed at the same time side by side.
 */
describe('layoutWorkflowDiagram of steps declaring dependsOn', () => {

  it('keeps the one-column layout when every step comes after all the steps listed before it', () => {
    const sequential = workflowOf([step('a', undefined, []), step('b', undefined, ['a']), step('c', [], ['a', 'b'])]);
    const unknown = workflowOf(sequential.steps.map(each => ({ ...each, dependsOn: undefined, prerequisites: undefined })));

    const geometry = (diagram: WorkflowDiagram) => ({ width: diagram.width, height: diagram.height, edges: diagram.edges,
      nodes: diagram.nodes.map(each => [each.id, each.x, each.y, each.width, each.height]) });

    expect(geometry(layoutWorkflowDiagram(sequential))).toEqual(geometry(layoutWorkflowDiagram(unknown)));
    expect(edges(layoutWorkflowDiagram(sequential))).toEqual(['inputs -> step:a', 'step:a -> step:b', 'step:b -> step:c',
      'step:c -> outputs']);
  });

  it('places the steps that share the same prerequisites side by side, in the order of the list', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice());
    const readMenu = node(diagram, 'step:readMenu');
    const tastes = ['step:tasteEclair', 'step:tasteMillefeuille', 'step:tasteEclairXml'].map(id => node(diagram, id));
    const reprice = node(diagram, 'step:reprice');

    expect(diagram.nodes.map(each => each.id)).toEqual(['inputs', 'step:readMenu', 'step:tasteEclair',
      'step:tasteMillefeuille', 'step:tasteEclairXml', 'step:reprice', 'outputs']);
    expect(diagram.nodes.map(each => each.index)).toEqual([undefined, 0, 1, 2, 3, 4, undefined]);
    tastes.forEach(taste => {
      expect(taste.y).withContext(taste.id).toEqual(tastes[0].y);
      expect(taste.y).withContext(taste.id).toBeGreaterThan(readMenu.y + readMenu.height);
      expect(reprice.y).withContext(taste.id).toBeGreaterThan(taste.y + taste.height);
    });
    expect(tastes[0].x + tastes[0].width).toBeLessThan(tastes[1].x);
    expect(tastes[1].x + tastes[1].width).toBeLessThan(tastes[2].x);
  });

  it('centres each row on the widest one', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice());
    const middle = (id: string) => node(diagram, id).x + node(diagram, id).width / 2;

    ['inputs', 'step:readMenu', 'step:reprice', 'outputs']
      .forEach(id => expect(middle(id)).withContext(id).toEqual(middle('step:tasteMillefeuille')));
  });

  it('draws an edge from each step a step comes after, leaving out those an other prerequisite already comes after', () => {
    expect(edges(layoutWorkflowDiagram(tasteThenReprice()))).toEqual([
      'inputs -> step:readMenu',
      'step:readMenu -> step:tasteEclair',
      'step:readMenu -> step:tasteMillefeuille',
      'step:readMenu -> step:tasteEclairXml',
      'step:tasteEclair -> step:reprice',
      'step:tasteMillefeuille -> step:reprice',
      'step:tasteEclairXml -> step:reprice',
      'step:reprice -> outputs'
    ]);
  });

  it('links the inputs to every step without prerequisite, and every step no step comes after to the outputs', () => {
    const diagram = layoutWorkflowDiagram(workflowOf([step('a', [], []), step('b', [], []), step('c', ['a'], ['a'])]));

    expect(edges(diagram)).toEqual(['inputs -> step:a', 'inputs -> step:b', 'step:a -> step:c', 'step:b -> outputs',
      'step:c -> outputs']);
    expect(node(diagram, 'step:a').y).toEqual(node(diagram, 'step:b').y);
  });

  it('places a step one row below its lowest prerequisite', () => {
    const diagram = layoutWorkflowDiagram(workflowOf([step('a', [], []), step('b', ['a'], ['a']),
      step('c', ['a', 'b'], ['a', 'b']), step('d', ['a'], ['a'])]));

    expect(node(diagram, 'step:c').y).toBeGreaterThan(node(diagram, 'step:b').y + node(diagram, 'step:b').height);
    expect(node(diagram, 'step:d').y).toEqual(node(diagram, 'step:b').y);
    expect(edges(diagram)).toEqual(['inputs -> step:a', 'step:a -> step:b', 'step:b -> step:c', 'step:a -> step:d',
      'step:c -> outputs', 'step:d -> outputs']);
  });

  it('draws an edge from the bottom middle of a prerequisite to the top middle of its step', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice());
    const readMenu = node(diagram, 'step:readMenu');
    const eclair = node(diagram, 'step:tasteEclair');
    const millefeuille = node(diagram, 'step:tasteMillefeuille');
    const from = readMenu.x + readMenu.width / 2;
    const bottom = readMenu.y + readMenu.height;
    const path = (to: string) => diagram.edges.find(edge => edge.from === 'step:readMenu' && edge.to === to)!.path;

    expect(path('step:tasteMillefeuille')).toEqual(`M ${from} ${bottom} L ${from} ${millefeuille.y}`);
    const bend = eclair.y - 28;
    const to = eclair.x + eclair.width / 2;
    expect(path('step:tasteEclair')).toEqual(`M ${from} ${bottom} C ${from} ${bend} ${to} ${bend} ${to} ${eclair.y}`);
  });

  it('gives a row the height of its tallest node, measured once rendered', () => {
    const estimated = layoutWorkflowDiagram(tasteThenReprice());

    const measured = layoutWorkflowDiagram(tasteThenReprice(), { 'step:tasteMillefeuille': 400 });

    expect(node(measured, 'step:tasteMillefeuille').height).toEqual(400);
    expect(node(measured, 'step:tasteEclair').y).toEqual(node(measured, 'step:tasteMillefeuille').y);
    expect(node(measured, 'step:reprice').y - node(estimated, 'step:reprice').y)
      .toEqual(400 - node(estimated, 'step:tasteMillefeuille').height);
  });

  it('leaves room for the actions of a step before the next step of its row, inside the diagram', () => {
    const workflow = tasteThenReprice();
    workflow.steps[1].onFailure = [{ name: 'tasteAgain', type: 'retry', retryAfter: 1, retryLimit: 3, criteria: [] },
      { name: 'giveUp', type: 'end', criteria: [] }];

    const diagram = layoutWorkflowDiagram(workflow);
    const labels = diagram.edges.filter(edge => edge.label).map(edge => edge.label!);

    expect(diagram.edges.filter(edge => edge.kind !== 'sequence').map(edge => edge.kind + ' ' + edge.from))
      .toEqual(['end step:tasteEclair', 'retry step:tasteEclair']);
    labels.forEach(label => {
      expect(inside(label, diagram)).withContext(label.lines[0]).toBeTrue();
      diagram.nodes.forEach(each => expect(overlap(label, each)).withContext(label.lines[0] + ' / ' + each.id).toBeFalse());
    });
    diagram.nodes.forEach(each => expect(inside(each, diagram)).withContext(each.id).toBeTrue());
  });

  it('fits 3 parallel steps within the width it is given, narrowing every node', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice(), {}, 860);
    const tastes = ['step:tasteEclair', 'step:tasteMillefeuille', 'step:tasteEclairXml'].map(id => node(diagram, id));

    expect(diagram.width).toBeLessThanOrEqual(860);
    diagram.nodes.forEach(each => {
      expect(each.width).withContext(each.id).toBeLessThan(300);
      expect(each.width).withContext(each.id).toBeGreaterThanOrEqual(220);
      expect(inside(each, diagram)).withContext(each.id).toBeTrue();
    });
    tastes.forEach(taste => expect(taste.y).withContext(taste.id).toEqual(tastes[0].y));
    expect(tastes[0].x + tastes[0].width).toBeLessThan(tastes[1].x);
    expect(tastes[1].x + tastes[1].width).toBeLessThan(tastes[2].x);
  });

  it('keeps nodes their full width when the widest row fits the width it is given', () => {
    const wide = layoutWorkflowDiagram(tasteThenReprice(), {}, 2000);

    expect(wide).toEqual(layoutWorkflowDiagram(tasteThenReprice()));
    expect(wide.nodes.map(each => each.width)).toEqual(wide.nodes.map(() => 300));
  });

  it('gives a narrowed step room for the lines its text wraps on', () => {
    const narrow = node(layoutWorkflowDiagram(tasteThenReprice(), {}, 760), 'step:reprice');
    const wide = node(layoutWorkflowDiagram(tasteThenReprice()), 'step:reprice');

    expect(narrow.width).toBeLessThan(wide.width);
    expect(narrow.height).toBeGreaterThanOrEqual(wide.height);
  });

  it('wraps the steps of a level onto several rows when even the narrowest nodes do not fit side by side', () => {
    const workflow = tasteThenReprice();
    workflow.steps.splice(4, 0, step('tasteBaba', ['readMenu'], ['readMenu']));
    workflow.steps[5].prerequisites = ['readMenu', 'tasteEclair', 'tasteMillefeuille', 'tasteEclairXml', 'tasteBaba'];

    const diagram = layoutWorkflowDiagram(workflow, {}, 600);
    const [eclair, millefeuille, xml, baba] = ['step:tasteEclair', 'step:tasteMillefeuille', 'step:tasteEclairXml',
      'step:tasteBaba'].map(id => node(diagram, id));

    expect(diagram.width).toBeLessThanOrEqual(600);
    expect(millefeuille.y).toEqual(eclair.y);
    expect(xml.y).toBeGreaterThan(eclair.y + eclair.height);
    expect(baba.y).toEqual(xml.y);
    expect(node(diagram, 'step:reprice').y).toBeGreaterThan(xml.y + xml.height);
    expect(edges(diagram).filter(edge => edge.startsWith('step:readMenu'))).toEqual(['step:readMenu -> step:tasteEclair',
      'step:readMenu -> step:tasteMillefeuille', 'step:readMenu -> step:tasteEclairXml', 'step:readMenu -> step:tasteBaba']);
    diagram.nodes.forEach(each => diagram.nodes.filter(other => other !== each)
      .forEach(other => expect(overlap(each, other)).withContext(each.id + ' / ' + other.id).toBeFalse()));
  });

  it('keeps one node per row, at the narrowest, in a width too small even for one: the panel then scrolls', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice(), {}, 200);

    expect(new Set(diagram.nodes.map(each => each.y)).size).toEqual(diagram.nodes.length);
    expect(diagram.nodes.map(each => each.width)).toEqual(diagram.nodes.map(() => 220));
  });

  it('leaves the one-column layout as it is, whatever the width it is given', () => {
    const sequential = workflowOf([step('a', undefined, []), step('b', undefined, ['a'])]);

    expect(layoutWorkflowDiagram(sequential, {}, 400)).toEqual(layoutWorkflowDiagram(sequential));
  });

  it('draws no data edge: the Steps view and the Inputs panel tell where each value goes', () => {
    const diagram = layoutWorkflowDiagram(tasteThenReprice());

    expect(diagram.edges.filter(edge => edge.kind === 'data')).toEqual([]);
  });
});
