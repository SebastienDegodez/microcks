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
import { ArazzoStepDetail } from '../../../../models/arazzo-workflow.model';
import { listenOnChannels, placeThenConfirm } from '../../../../../test-data/order-events';
import { DiagramNode, WorkflowDiagram, layoutWorkflowDiagram } from './workflow-diagram.layout';

function node(diagram: WorkflowDiagram, id: string): DiagramNode {
  return diagram.nodes.find(candidate => candidate.id === id)!;
}

/** S28, AC-02: the diagram estimates the room each step of an AsyncAPI source takes before it is measured. */
describe('layoutWorkflowDiagram of steps that send or receive messages', () => {

  it('gives a receive step room for the message it waits for and its timeout', () => {
    const workflow = placeThenConfirm();
    const confirmOrder = workflow.steps[2];
    const withoutMessage: ArazzoStepDetail = { ...confirmOrder, messaging: { action: 'receive' } };

    const withLine = node(layoutWorkflowDiagram(workflow), 'step:confirmOrder');
    workflow.steps[2] = withoutMessage;
    const withoutLine = node(layoutWorkflowDiagram(workflow), 'step:confirmOrder');

    expect(withLine.height - withoutLine.height).toEqual(4 + 16 * 2);
  });

  it('gives a step on a channel no room for an operation it does not name, and a channel not found room for its reason', () => {
    const diagram = layoutWorkflowDiagram(listenOnChannels());

    expect(node(diagram, 'step:confirmed').height).toEqual(2 * 2 + 2 * 10 + 28 + 20);
    expect(node(diagram, 'step:shipped').height).toEqual(2 * 2 + 2 * 10 + 28 + 20 * 2);
  });
});
