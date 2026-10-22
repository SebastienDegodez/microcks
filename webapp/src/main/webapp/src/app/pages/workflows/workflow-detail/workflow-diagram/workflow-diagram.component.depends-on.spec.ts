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
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { tasteThenReprice } from '../../../../../test-data/pastry-tasting';
import { WorkflowDiagramComponent } from './workflow-diagram.component';

/**
 * S30: the parallel branches of a workflow whose steps declare dependsOn fit the panel of the diagram, rather than being
 * cut at its right edge.
 */
describe('WorkflowDiagramComponent of steps declaring dependsOn', () => {
  let fixture: ComponentFixture<WorkflowDiagramComponent>;

  async function render(panelWidth: number): Promise<HTMLElement> {
    fixture = TestBed.createComponent(WorkflowDiagramComponent);
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = panelWidth + 'px';
    document.body.appendChild(host);
    fixture.componentRef.setInput('workflow', tasteThenReprice());
    fixture.detectChanges();
    // The diagram is laid out again once its panel and its nodes are measured.
    for (let pass = 0; pass < 3; pass++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      fixture.detectChanges();
    }
    return host;
  }

  afterEach(() => fixture.nativeElement.remove());

  it('fits 3 parallel steps within the width of its panel', async () => {
    const host = await render(860);
    const frame = host.querySelector('.workflow-diagram') as HTMLElement;
    const canvas = host.querySelector('.diagram-canvas') as HTMLElement;
    const nodes = Array.from(host.querySelectorAll('.diagram-node')) as HTMLElement[];
    const tastes = ['tasteEclair', 'tasteMillefeuille', 'tasteEclairXml']
      .map(stepId => host.querySelector('[data-node-id="step:' + stepId + '"]') as HTMLElement);

    expect(canvas.offsetWidth).toBeLessThanOrEqual(frame.clientWidth);
    expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
    nodes.forEach(node => expect(node.offsetLeft + node.offsetWidth).withContext(node.dataset['nodeId']!)
      .toBeLessThanOrEqual(canvas.offsetWidth));
    tastes.forEach(taste => expect(taste.offsetTop).withContext(taste.dataset['nodeId']!).toEqual(tastes[0].offsetTop));
  });
});
