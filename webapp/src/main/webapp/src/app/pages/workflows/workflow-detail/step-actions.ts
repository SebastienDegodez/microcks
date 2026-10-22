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
import { ArazzoStepAction, ArazzoStepCriterion, ArazzoStepDetail } from '../../../models/arazzo-workflow.model';

/** An action of a step as the workflow page words it: when it applies, and what it does. */
export type StepActionLine = {
  outcome: 'success' | 'failure';
  /** The place of the action among those of its outcome, from 0. */
  position: number;
  action: ArazzoStepAction;
  /** "On success" or "On failure". */
  when: string;
  /** What the action does, such as "retry every 1 s, up to 5 times". */
  text: string;
  /** The whole line, with the criteria the action applies on: "On failure: retry ... when $statusCode == 503". */
  summary: string;
};

/** The actions of a step, those applying on success first, each in the order of the document. */
export function stepActionLines(step: ArazzoStepDetail): StepActionLine[] {
  const lines = (outcome: 'success' | 'failure', actions: ArazzoStepAction[] = []) =>
    actions.map((action, position) => {
      const when = outcome === 'success' ? 'On success' : 'On failure';
      const text = describeAction(action);
      const criteria = action.criteria.map(describeCriterion).join(', ');
      return { outcome, position, action, when, text,
        summary: when + ': ' + text + (criteria ? ' when ' + criteria : '') };
    });
  return [...lines('success', step.onSuccess), ...lines('failure', step.onFailure)];
}

/** "retry every 1 s, up to 5 times", "retry at once, up to 1 time", or "end the workflow". */
export function describeAction(action: ArazzoStepAction): string {
  if (action.type !== 'retry') {
    return 'end the workflow';
  }
  const limit = action.retryLimit ?? 1;
  return 'retry ' + (action.retryAfter ? 'every ' + action.retryAfter + ' s' : 'at once') + ', up to ' + limit
    + (limit === 1 ? ' time' : ' times');
}

function describeCriterion(criterion: ArazzoStepCriterion): string {
  return criterion.condition + (criterion.context ? ' on ' + criterion.context : '');
}
