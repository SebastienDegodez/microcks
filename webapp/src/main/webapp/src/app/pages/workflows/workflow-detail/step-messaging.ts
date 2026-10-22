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
import { ArazzoStepDetail } from '../../../models/arazzo-workflow.model';

/**
 * What a step of an AsyncAPI source does with messages: send or receive, as the step tells it, else as Microcks names
 * its AsyncAPI operation (send, receive, publish or subscribe); undefined when neither tells it.
 */
export function stepAction(step: ArazzoStepDetail): string | undefined {
  return step.messaging?.action ?? step.operation.method?.toLowerCase();
}

/** Where a step of an AsyncAPI source sends or receives, as its heading shows it: "RECEIVE orders/confirmed". */
export function stepEndpoint(step: ArazzoStepDetail): string {
  return [stepAction(step)?.toUpperCase(), step.operation.channel].filter(part => !!part).join(' ');
}

/** The message a receive step waits for, and for how long: "correlationId ← $inputs.id · timeout 6000 ms". */
export function stepMessagingSummary(step: ArazzoStepDetail): string {
  const parts: string[] = [];
  if (step.messaging?.correlationId) {
    parts.push('correlationId ← ' + step.messaging.correlationId);
  }
  if (step.messaging?.timeout != null) {
    parts.push('timeout ' + step.messaging.timeout + ' ms');
  }
  return parts.join(' · ');
}
