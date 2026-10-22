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
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Observable, merge, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  Notification,
  NotificationEvent,
  NotificationService,
  NotificationType,
  ToastNotificationListComponent
} from '../../../../components/patternfly-ng/notification';
import { ArazzoWorkflowDetail } from '../../../../models/arazzo-workflow.model';
import { encodeUrl, mockServerOrigin } from '../../../../utils/format-utils';

/** The value a curl gives an input of each JSON schema type when no recorded example tells it. */
const PLACEHOLDERS: Record<string, unknown> = { number: 0, integer: 0, boolean: false, object: {}, array: [] };

/**
 * The Mock URL of a workflow: an application posts the inputs of the workflow to it, Microcks plays the workflow on its
 * mocks and answers with its outputs. A curl shows how, with the inputs of the first recorded example of the workflow,
 * else with a placeholder typed from the input schema for each input.
 */
@Component({
  selector: 'app-workflow-mock-url',
  templateUrl: './workflow-mock-url.component.html',
  styleUrls: ['./workflow-mock-url.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ToastNotificationListComponent],
  providers: [NotificationService]
})
export class WorkflowMockUrlComponent {

  @Input({ required: true }) workflow!: ArazzoWorkflowDetail;

  readonly notifications: Observable<Notification[]>;

  constructor(private notificationService: NotificationService) {
    this.notifications = merge(of(undefined), notificationService.getNotificationsObserver)
      .pipe(map(() => [...notificationService.getNotifications()]));
  }

  /** The Mock URL of the workflow: /arazzo/{title}/{version}/{workflowId}, encoded like the API mock URLs. */
  get mockUrl(): string {
    return mockServerOrigin() + '/arazzo/' + encodeUrl(this.workflow.title) + '/' + this.workflow.version + '/'
      + this.workflow.workflowId;
  }

  /** A curl posting the inputs to the Mock URL, ready to paste in a shell. */
  get curl(): string {
    return 'curl -X POST ' + quoted(this.mockUrl) + ' \\\n'
      + '  -H \'Content-Type: application/json\' \\\n'
      + '  -d ' + quoted(JSON.stringify(this.inputs()));
  }

  /** The inputs of the first recorded example, else a placeholder typed from the input schema for each input. */
  private inputs(): Record<string, unknown> {
    const example = this.workflow.examples?.[0];
    if (example) {
      return example.inputs;
    }
    return Object.fromEntries(this.workflow.inputs.map(input =>
      [input.name, input.type !== undefined && input.type in PLACEHOLDERS ? PLACEHOLDERS[input.type] : '<' + input.name + '>']));
  }

  /** Copy a Mock URL or its curl to the clipboard, like the Mock URL of an API page, and tell it. */
  copyToClipboard(text: string, what: string): void {
    const selBox = document.createElement('textarea');
    selBox.style.position = 'fixed';
    selBox.style.left = '0';
    selBox.style.top = '0';
    selBox.style.opacity = '0';
    selBox.value = text;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand('copy');
    document.body.removeChild(selBox);
    this.notificationService.message(NotificationType.INFO, this.workflow.workflowId,
      'The ' + what + ' of ' + this.workflow.workflowId + ' has been copied to clipboard', false);
  }

  handleCloseNotification($event: NotificationEvent): void {
    this.notificationService.remove($event.notification);
  }
}

/** A shell word in single quotes, a single quote inside closing, escaping and reopening them. */
function quoted(word: string): string {
  return '\'' + word.replace(/'/g, '\'\\\'\'') + '\'';
}
