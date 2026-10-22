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

/**
 * The demo of S28: the Order events scenarios, an Arazzo 1.1 document mixing the Order API (OpenAPI) and the Order
 * events (AsyncAPI 3), whose steps place an order over HTTP, then send and receive messages.
 */

const ASYNC_REASON = 'Async steps cannot be run yet: requestShipping, confirmOrder';

function orderEvents(workflowId: string, steps: ArazzoStepDetail[], reasons: string[]): ArazzoWorkflowDetail {
  return {
    documentId: 'events-doc',
    title: 'Order events scenarios',
    version: '1.0.0',
    arazzoVersion: '1.1.0',
    fileName: 'order-events.arazzo.yaml',
    importDate: Date.now() - 3600 * 1000,
    workflowIds: ['placeThenConfirm', 'listenOnChannels'],
    sources: [
      { link: { sourceName: 'orderApi', apiName: 'Order API', apiVersion: '1.0.0', linked: true },
        serviceId: 'svc-orders', operations: 1, usedOperations: 1 },
      { link: { sourceName: 'orderEvents', apiName: 'Order events', apiVersion: '1.0.0', linked: true },
        serviceId: 'svc-events', operations: 2, usedOperations: 2 }
    ],
    workflowId,
    inputs: [{ name: 'customer', type: 'string', required: true,
      usedBy: [{ stepId: 'requestShipping', place: 'header', target: 'customer' }] }],
    steps,
    outputs: { status: '$steps.confirmOrder.outputs.status' },
    dataPassings: [
      { fromStepId: 'createOrder', outputName: 'orderId', to: { stepId: 'requestShipping', place: 'body', target: '/orderId' } },
      { fromStepId: 'createOrder', outputName: 'orderId', to: { stepId: 'confirmOrder', place: 'correlationId' } }
    ],
    status: { workflowId, runnable: false, reasons }
  };
}

/** placeThenConfirm: createOrder over HTTP, requestShipping sends a message, confirmOrder receives the confirmation. */
export function placeThenConfirm(): ArazzoWorkflowDetail {
  return orderEvents('placeThenConfirm', [
    { stepId: 'createOrder',
      operation: { sourceName: 'orderApi', operationId: 'CreateOrder', method: 'POST', path: '/orders' },
      parameters: [], successCriteria: [{ condition: '$statusCode == 201', type: 'simple' }],
      outputs: { orderId: '$response.body#/id' }, onSuccess: [], onFailure: [] },
    { stepId: 'requestShipping',
      operation: { sourceName: 'orderEvents', operationId: 'sendShippingRequest', method: 'SEND',
        path: 'sendShippingRequest', channel: 'shipping/requests' },
      parameters: [{ name: 'customer', in: 'header', value: '$inputs.customer' }],
      requestBody: { payload: '{\n  "orderId" : ""\n}', replacements: { '/orderId': '$steps.createOrder.outputs.orderId' } },
      successCriteria: [], outputs: {}, onSuccess: [], onFailure: [],
      messaging: { action: 'send' } },
    { stepId: 'confirmOrder',
      operation: { sourceName: 'orderEvents', operationId: 'receiveOrderConfirmed', method: 'RECEIVE',
        path: 'receiveOrderConfirmed', channel: 'orders/confirmed' },
      parameters: [], successCriteria: [{ condition: '$message.payload#/status == \'confirmed\'', type: 'simple' }],
      outputs: { status: '$message.payload#/status' }, onSuccess: [], onFailure: [],
      messaging: { action: 'receive', correlationId: '$steps.createOrder.outputs.orderId', timeout: 6000 } }
  ], [ASYNC_REASON]);
}

/**
 * listenOnChannels: confirmed receives on a channel its channelPath points to, without operation; shipped points to
 * a channel the AsyncAPI contract does not define; legacy calls an AsyncAPI 2 operation without telling its action.
 */
export function listenOnChannels(): ArazzoWorkflowDetail {
  const workflow = orderEvents('listenOnChannels', [
    { stepId: 'confirmed', operation: { sourceName: 'orderEvents', channel: 'orders/confirmed' },
      parameters: [], successCriteria: [], outputs: {}, messaging: { action: 'receive' } },
    { stepId: 'shipped',
      operation: { sourceName: 'orderEvents', channel: 'orderShipped',
        reason: 'Channel orderShipped not found in Order events 1.0.0' },
      parameters: [], successCriteria: [], outputs: {}, messaging: { action: 'receive' } },
    { stepId: 'legacy',
      operation: { sourceName: 'orderEvents', operationId: 'receiveOrderConfirmed', method: 'SUBSCRIBE',
        path: 'orders/confirmed', channel: 'orders/confirmed' },
      parameters: [], successCriteria: [], outputs: {}, messaging: {} }
  ], ['Channel orderShipped not found in Order events 1.0.0', 'Async steps cannot be run yet: confirmed, shipped, legacy']);
  workflow.inputs = [];
  workflow.dataPassings = [];
  workflow.outputs = {};
  return workflow;
}
