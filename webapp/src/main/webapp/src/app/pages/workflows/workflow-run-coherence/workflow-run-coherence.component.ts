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
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { BsModalService } from 'ngx-bootstrap/modal';

import { WorkflowMissingExample, WorkflowParameterValue, WorkflowResult } from '../../../models/arazzo-run.model';
import { Exchange, Service } from '../../../models/service.model';
import { AICopilotService } from '../../../services/aicopilot.service';
import { IAuthenticationService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { ServicesService } from '../../../services/services.service';
import { GenerateSamplesDialogComponent } from '../../services/{serviceId}/_components/generate-samples.dialog';

/** A runtime expression reading the output of a previous step: $steps.<stepId>.outputs.<name>. */
const STEP_OUTPUT = /^\$steps\.([^.]+)\.outputs\./;
/** A runtime expression reading an input of the workflow: $inputs.<name>. */
const INPUT = /^\$inputs\.(.+)$/;

/**
 * Under the step of a run against the mocks that failed for a missing example: what the operation lacks, where the
 * values came from, and how to fix it (screen 6 of the mock-up).
 */
@Component({
  selector: 'app-workflow-run-coherence',
  templateUrl: './workflow-run-coherence.component.html',
  styleUrls: ['./workflow-run-coherence.component.css'],
  imports: [CommonModule, RouterLink]
})
export class WorkflowRunCoherenceComponent {

  @Input({ required: true }) run!: WorkflowResult;
  @Input({ required: true }) missing!: WorkflowMissingExample;

  /** What became of the examples the AI Copilot generated; absent until some are saved. */
  outcome?: string;

  constructor(private config: ConfigService, private authService: IAuthenticationService,
              private servicesSvc: ServicesService, private copilotSvc: AICopilotService,
              private modals: BsModalService) {
  }

  /** "GetPastries returns “Baba Rhum”", "The input pastry is “Eclair Cafe”": where the values the mocks lack came from. */
  origins(): string {
    const origins = this.missing.parameters.map(parameter => this.originOf(parameter))
      .filter((origin): origin is string => !!origin);
    const sentence = this.enumerate(origins);
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
  }

  private originOf(parameter: WorkflowParameterValue): string | undefined {
    const value = '“' + this.sent(parameter.value) + '”';
    const input = INPUT.exec(parameter.expression ?? '');
    if (input) {
      return 'the input ' + input[1] + ' is ' + value;
    }
    const output = STEP_OUTPUT.exec(parameter.expression ?? '');
    const producer = output && this.run.steps.find(step => step.stepId === output[1]);
    return producer ? producer.operation.operationId + ' returns ' + value : undefined;
  }

  /** The last parameter the operation has no example for; the others are separated by commas. */
  isLast(index: number): boolean {
    return index === this.missing.parameters.length - 1;
  }

  /** The value of a parameter as it was sent: text as is, anything else as JSON. */
  sent(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  /** The API whose mocks lack the example, as the run names it. */
  apiOf(): string {
    const source = this.run.sources.find(candidate => candidate.serviceId === this.missing.serviceId);
    return source ? source.apiName + ' ' + source.apiVersion : '';
  }

  /** The AI Copilot generates examples for a manager when it is enabled, as on the page of the API. */
  hasAICopilotEnabled(): boolean {
    return this.authService.hasRole('manager') && this.config.hasFeatureEnabled('ai-copilot');
  }

  generateWithAICopilot(): void {
    this.servicesSvc.getService(this.missing.serviceId).subscribe(service => this.openSamplesDialog(service));
  }

  private openSamplesDialog(service: Service): void {
    const operationName = this.missing.operationName;
    const dialog = this.modals.show(GenerateSamplesDialogComponent, {
      initialState: { closeBtnName: 'Cancel', service, operationName }
    });
    dialog.setClass('modal-lg');
    dialog.content!.saveSamplesAction.subscribe((exchanges: Exchange[]) => {
      this.copilotSvc.addSamplesSuggestions(service, operationName, exchanges).subscribe({
        next: () => this.outcome = 'Examples have been added to ' + operationName + '.',
        error: (err: Error) => this.outcome = 'Examples cannot be added (' + err.message + ').'
      });
    });
  }

  private enumerate(items: string[]): string {
    return items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
}
