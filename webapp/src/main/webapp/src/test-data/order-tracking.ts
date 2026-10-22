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
import { ArazzoStepDetail, ArazzoWorkflowDetail } from '../app/models/arazzo-workflow.model';
import { WorkflowResult, WorkflowStepResult } from '../app/models/arazzo-run.model';

/** The demo of S17: the Order tracking document, whose steps poll the stateful status mock of the Order status API. */

const GET_ORDER_STATUS = { sourceName: 'orderStatusApi', operationId: 'getOrderStatus', method: 'GET',
  path: '/order/{id}/status' };
const GET_ORDER = { sourceName: 'orderStatusApi', operationId: 'getOrder', method: 'GET', path: '/order/{id}' };
const READY = '$response.body#/status == \'ready\'';
const PREPARING = '$response.body#/status == \'preparing\'';

function orderTracking(workflowId: string, steps: ArazzoStepDetail[], outputs: Record<string, string>): ArazzoWorkflowDetail {
  return {
    documentId: 'order-doc',
    title: 'Order tracking',
    version: '1.0.0',
    arazzoVersion: '1.0.1',
    fileName: 'order-tracking.arazzo.yaml',
    importDate: Date.now() - 3600 * 1000,
    workflowIds: ['waitUntilReady', 'giveUpQuickly', 'readUnlessPreparing'],
    sources: [{ link: { sourceName: 'orderStatusApi', apiName: 'Order status', apiVersion: '1.0.0', linked: true },
      serviceId: 'svc-order', operations: 2, usedOperations: 2 }],
    workflowId,
    inputs: [{ name: 'orderId', type: 'string', required: true,
      usedBy: steps.map(step => ({ stepId: step.stepId, place: 'path', target: 'id' })) }],
    steps,
    outputs,
    dataPassings: [],
    status: { workflowId, runnable: true, reasons: [] }
  };
}

function statusStep(stepId: string, extra: Partial<ArazzoStepDetail>): ArazzoStepDetail {
  return { stepId, operation: GET_ORDER_STATUS, parameters: [{ name: 'id', in: 'path', value: '$inputs.orderId' }],
    successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }], outputs: { status: '$response.body#/status' },
    ...extra };
}

function readOrder(): ArazzoStepDetail {
  return { stepId: 'readOrder', operation: GET_ORDER, parameters: [{ name: 'id', in: 'path', value: '$inputs.orderId' }],
    successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }], outputs: { item: '$response.body#/item' },
    onSuccess: [], onFailure: [] };
}

/** waitUntilReady: pollStatus is retried every second, up to 5 times, until the order is ready; then readOrder. */
export function waitUntilReady(): ArazzoWorkflowDetail {
  return orderTracking('waitUntilReady', [
    statusStep('pollStatus', {
      successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }, { condition: READY, type: 'simple' }],
      onSuccess: [],
      onFailure: [{ name: 'notReadyYet', type: 'retry', retryAfter: 1, retryLimit: 5, criteria: [] }]
    }),
    readOrder()
  ], { status: '$steps.pollStatus.outputs.status', item: '$steps.readOrder.outputs.item' });
}

/** readUnlessPreparing: checkStatus ends the workflow while the order is preparing, or when it fails. */
export function readUnlessPreparing(): ArazzoWorkflowDetail {
  return orderTracking('readUnlessPreparing', [
    statusStep('checkStatus', {
      onSuccess: [{ name: 'stillPreparing', type: 'end', criteria: [{ condition: PREPARING, type: 'simple' }] }],
      onFailure: [{ name: 'unknownOrder', type: 'end', criteria: [] }]
    }),
    readOrder()
  ], { status: '$steps.checkStatus.outputs.status', item: '$steps.readOrder.outputs.item' });
}

/** An attempt of pollStatus that answered a status: it passes when the order is ready. */
function pollStatus(index: number, status: string): WorkflowStepResult {
  return { index, stepId: 'pollStatus', operation: GET_ORDER_STATUS, status: status === 'ready' ? 'PASSED' : 'FAILED',
    statusCode: 200, elapsedTime: 4, outputs: status === 'ready' ? { status } : {},
    criteria: [
      { condition: '$statusCode == 200', values: [{ expression: '$statusCode', value: 200 }], held: true },
      { condition: READY, values: [{ expression: '$response.body#/status', value: status }], held: status === 'ready' }
    ],
    testCaseId: 'run-1-' + index, requestUrl: 'http://localhost:8080/rest/Order+status/1.0.0/order/42/status',
    parameters: [{ name: 'id', in: 'path', value: '42', expression: '$inputs.orderId' }], outputOrigins: {} };
}

function run(workflowId: string, status: WorkflowResult['status'], steps: WorkflowStepResult[],
             outputs: Record<string, unknown>): WorkflowResult {
  return {
    id: 'run-1', number: 4, documentId: 'order-doc', documentTitle: 'Order tracking', documentVersion: '1.0.0',
    workflowId, target: 'MOCKS', sources: [{ sourceName: 'orderStatusApi', serviceId: 'svc-order',
      apiName: 'Order status', apiVersion: '1.0.0', baseUrl: '/rest/Order+status/1.0.0' }],
    inputs: { orderId: '42' }, outputs, status, startedDate: Date.now() - 60 * 1000, elapsedTime: 2016,
    timeout: 10000, steps, validateSchema: false
  };
}

/** A run of waitUntilReady that passed: pollStatus answered preparing, preparing, then ready. */
export function passedAfterRetries(): WorkflowResult {
  return run('waitUntilReady', 'SUCCESS', [pollStatus(0, 'preparing'), pollStatus(1, 'preparing'),
    pollStatus(2, 'ready'),
    { index: 3, stepId: 'readOrder', operation: GET_ORDER, status: 'PASSED', statusCode: 200, elapsedTime: 4,
      criteria: [], outputs: { item: 'Eclair Cafe' } }
  ], { status: 'ready', item: 'Eclair Cafe' });
}

/** A run of giveUpQuickly that failed: pollStatus answered preparing twice, and its one retry was exhausted. */
export function exhaustedRetries(): WorkflowResult {
  return run('giveUpQuickly', 'FAILURE', [pollStatus(0, 'preparing'), pollStatus(1, 'preparing')], {});
}
