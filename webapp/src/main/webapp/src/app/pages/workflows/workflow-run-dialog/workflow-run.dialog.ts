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
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';

import { ArazzoSourceDescription, ArazzoWorkflowDetail, ArazzoWorkflowInput } from '../../../models/arazzo-workflow.model';
import { WorkflowRunImplementations } from '../../../models/arazzo-run.model';
import { Secret } from '../../../models/secret.model';
import { ArazzoRunService } from '../../../services/arazzo-run.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { SecretsService } from '../../../services/secrets.service';

/** A piece of the sentence telling where an input is used: some text, or an identifier shown as code. */
export type UsePart = { text: string; code?: string };

/** How each place of a step names what it holds. */
const PLACES: Record<string, string> = {
  path: 'path parameter',
  query: 'query parameter',
  header: 'header',
  body: 'body'
};

/**
 * Open the dialog running a workflow of an Arazzo document.
 * @param workflowIds The workflows of the document that the dialog offers
 * @param workflowId  The workflow selected when the dialog opens
 */
export function openRunDialog(modals: BsModalService, documentId: string, workflowIds: string[],
                              workflowId: string): void {
  modals.show(WorkflowRunDialogComponent, {
    initialState: { documentId, workflowIds, workflowId },
    class: 'workflow-run-modal'
  });
}

/** What the steps of a run call. */
export type RunTarget = 'MOCKS' | 'IMPLEMENTATIONS';

/**
 * The dialog running a workflow of an Arazzo document against the Microcks mocks of its linked APIs, or against their
 * implementations.
 */
@Component({
  selector: 'app-workflow-run-dialog',
  templateUrl: './workflow-run.dialog.html',
  styleUrls: ['./workflow-run.dialog.css'],
  imports: [CommonModule, FormsModule]
})
export class WorkflowRunDialogComponent implements OnInit {

  readonly availableSoon = 'Available soon';

  documentId!: string;
  workflowIds!: string[];
  workflowId!: string;

  workflows: ArazzoWorkflowDetail[] = [];
  values: Record<string, string | number | null> = {};
  timeout = 10000;
  error?: string;
  running = false;
  target: RunTarget = 'MOCKS';
  /** The base URL of the implementation of each linked source, by source name. */
  baseUrls: Record<string, string> = {};
  /** The secrets the user may read, as contract tests offer them; read once implementations are chosen. */
  secrets?: Secret[];
  secretName: string | null = null;
  /** Once a run is refused, the inputs it needs that are still empty are marked. */
  refused = false;

  constructor(public bsModalRef: BsModalRef, private workflowSvc: ArazzoWorkflowService,
              private runSvc: ArazzoRunService, private router: Router, private secretsSvc: SecretsService) {
  }

  ngOnInit(): void {
    forkJoin(this.workflowIds.map(workflowId => this.workflowSvc.getWorkflow(this.documentId, workflowId)))
      .subscribe(workflows => this.workflows = workflows);
  }

  get selected(): ArazzoWorkflowDetail | undefined {
    return this.workflows.find(workflow => workflow.workflowId === this.workflowId);
  }

  selectWorkflow(workflowId: string): void {
    this.workflowId = workflowId;
    this.values = {};
    this.error = undefined;
    this.refused = false;
  }

  /** Whether an input a run needs is still empty after a run was refused. */
  isMissing(input: ArazzoWorkflowInput): boolean {
    return this.refused && !!input.required && isEmpty(this.values[input.name]);
  }

  selectTarget(target: RunTarget): void {
    this.target = target;
    if (target === 'IMPLEMENTATIONS' && !this.secrets) {
      this.secretsSvc.getSecrets().subscribe(secrets => this.secrets = secrets);
    }
  }

  /** The sources linked to an API: each one is called at the base URL of its implementation. */
  linkedSources(workflow: ArazzoWorkflowDetail): ArazzoSourceDescription[] {
    return workflow.sources.filter(source => source.link.linked);
  }

  /** A runnable workflow runs against the mocks, or against implementations once each linked source has its URL. */
  canRun(): boolean {
    const workflow = this.selected;
    if (!workflow?.status.runnable) {
      return false;
    }
    return this.target === 'MOCKS'
      || this.linkedSources(workflow).every(source => (this.baseUrls[source.link.sourceName] ?? '').trim() !== '');
  }

  /** Where the mocks of the first linked API are, as Microcks serves them. */
  mocksExample(workflow: ArazzoWorkflowDetail): string | null {
    const source = workflow.sources.find(candidate => candidate.link.linked);
    return source ? '/rest/' + encodeMockPart(source.link.apiName!) + '/' + encodeMockPart(source.link.apiVersion!)
      : null;
  }

  /** A number input for the inputs the workflow declares as numbers, a text input for the others. */
  inputKind(input: ArazzoWorkflowInput): string {
    return input.type === 'number' || input.type === 'integer' ? 'number' : 'text';
  }

  /** Where the steps use an input: "Body /price of reprice, and its success criterion". */
  useOf(input: ArazzoWorkflowInput): UsePart[] {
    const parts: UsePart[] = [];
    let previousStepId: string | undefined;
    input.usedBy.forEach(use => {
      const sameStep = use.stepId === previousStepId;
      if (previousStepId !== undefined) {
        parts.push({ text: sameStep ? ', and ' : '; ' });
      }
      if (use.place === 'criterion') {
        parts.push({ text: sameStep ? 'its success criterion' : 'Success criterion of ' + use.stepId });
      } else if (sameStep) {
        parts.push({ text: 'its ' + PLACES[use.place] + ' ' }, { text: '', code: use.target });
      } else {
        const place = PLACES[use.place];
        parts.push({ text: place.charAt(0).toUpperCase() + place.slice(1) + ' ' }, { text: '', code: use.target },
          { text: ' of ' + use.stepId });
      }
      previousStepId = use.stepId;
    });
    return parts;
  }

  run(): void {
    const workflow = this.selected!;
    const inputs: Record<string, unknown> = {};
    workflow.inputs.forEach(input => {
      const value = this.values[input.name];
      if (!isEmpty(value)) {
        inputs[input.name] = value;
      }
    });
    this.running = true;
    this.error = undefined;
    const launched = this.target === 'IMPLEMENTATIONS'
      ? this.runSvc.launchRun(this.documentId, workflow.workflowId, inputs, this.timeout, this.implementations(workflow))
      : this.runSvc.launchRun(this.documentId, workflow.workflowId, inputs, this.timeout);
    launched.subscribe({
      next: run => {
        this.bsModalRef.hide();
        this.router.navigate(['/workflows/runs', run.id]);
      },
      error: refusal => {
        this.running = false;
        this.refused = true;
        this.error = typeof refusal.error === 'string' ? refusal.error : 'Microcks could not run the workflow.';
      }
    });
  }

  private implementations(workflow: ArazzoWorkflowDetail): WorkflowRunImplementations {
    const baseUrls: Record<string, string> = {};
    this.linkedSources(workflow).forEach(source =>
      baseUrls[source.link.sourceName] = this.baseUrls[source.link.sourceName].trim());
    return this.secretName ? { baseUrls, secretName: this.secretName } : { baseUrls };
  }
}

/** An input left empty is not given. */
function isEmpty(value: string | number | null | undefined): boolean {
  return value === undefined || value === null || value === '';
}

/** Microcks writes the spaces of the name and version of an API as + in the URLs of its mocks. */
function encodeMockPart(part: string): string {
  return encodeURIComponent(part).replace(/%20/g, '+');
}
