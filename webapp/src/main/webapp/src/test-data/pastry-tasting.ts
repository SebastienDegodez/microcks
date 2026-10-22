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
 * The demo of S30: Pastry tasting, an Arazzo 1.1 workflow reading the menu, then tasting three pastries that only
 * depend on the menu (dependsOn: [readMenu]), then repricing the Eclair after all of them, as a step without dependsOn.
 */

function getPastry(stepId: string, name: string, dependsOn: string[]): ArazzoStepDetail {
  return {
    stepId,
    operation: { sourceName: 'pastryApi', operationId: 'GetPastryByName', method: 'GET', path: '/pastry/{name}' },
    parameters: [{ name: 'name', in: 'path', value: name }],
    successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
    outputs: {}, onSuccess: [], onFailure: [], dependsOn, prerequisites: dependsOn
  };
}

/** tasteThenReprice: readMenu, then tasteEclair, tasteMillefeuille and tasteEclairXml in any order, then reprice. */
export function tasteThenReprice(): ArazzoWorkflowDetail {
  return {
    documentId: 'tasting-doc',
    title: 'Pastry tasting',
    version: '1.0.0',
    arazzoVersion: '1.1.0',
    fileName: 'pastry-tasting.arazzo.yaml',
    importDate: Date.now() - 3600 * 1000,
    workflowIds: ['tasteThenReprice'],
    sources: [
      { link: { sourceName: 'pastryApi', apiName: 'API Pastry - 2.0', apiVersion: '2.0.0', linked: true },
        serviceId: 'svc-pastry', operations: 3, usedOperations: 3 }
    ],
    workflowId: 'tasteThenReprice',
    inputs: [{ name: 'newPrice', type: 'number', required: true,
      usedBy: [{ stepId: 'reprice', place: 'body', target: '/price' }] }],
    steps: [
      { stepId: 'readMenu',
        operation: { sourceName: 'pastryApi', operationId: 'GetPastries', method: 'GET', path: '/pastry' },
        parameters: [], successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
        outputs: {}, onSuccess: [], onFailure: [], dependsOn: [], prerequisites: [] },
      { ...getPastry('tasteEclair', 'Eclair Cafe', ['readMenu']), outputs: { name: '$response.body#/name' } },
      getPastry('tasteMillefeuille', 'Millefeuille', ['readMenu']),
      getPastry('tasteEclairXml', 'Eclair Cafe', ['readMenu']),
      { stepId: 'reprice',
        operation: { sourceName: 'pastryApi', operationId: 'PatchPastry', method: 'PATCH', path: '/pastry/{name}' },
        parameters: [{ name: 'name', in: 'path', value: '$steps.tasteEclair.outputs.name' }],
        requestBody: { contentType: 'application/json', payload: '{\n  "price" : 0\n}', replacements: { '/price': '$inputs.newPrice' } },
        successCriteria: [{ condition: '$statusCode == 200', type: 'simple' }],
        outputs: { price: '$response.body#/price' }, onSuccess: [], onFailure: [], dependsOn: [],
        prerequisites: ['readMenu', 'tasteEclair', 'tasteMillefeuille', 'tasteEclairXml'] }
    ],
    outputs: { price: '$steps.reprice.outputs.price' },
    dataPassings: [
      { fromStepId: 'tasteEclair', outputName: 'name', to: { stepId: 'reprice', place: 'path', target: 'name' } }
    ],
    status: { workflowId: 'tasteThenReprice', runnable: true, reasons: [] }
  };
}
