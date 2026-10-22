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
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ArazzoExampleLaunch, WorkflowResult, WorkflowRunImplementations } from '../models/arazzo-run.model';
import { RequestResponsePair } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ArazzoRunService {

  private rootUrl = '/api/arazzo';

  constructor(private http: HttpClient) { }

  /**
   * Run a workflow against the Microcks mocks of its linked APIs, or against their implementations.
   * @param inputs          The inputs of the workflow, by name
   * @param timeout         How long a step waits for its response, in milliseconds
   * @param implementations The base URL of each linked source and the secret of the calls; none for the mocks
   * @param validateSchema  Whether each response is validated against the OpenAPI schema of its operation
   * @param example         The recorded example the run plays; none for a run that plays no example
   */
  public launchRun(documentId: string, workflowId: string, inputs: Record<string, unknown>,
                   timeout: number, implementations?: WorkflowRunImplementations,
                   validateSchema = false, example?: string): Observable<WorkflowResult> {
    const target = implementations
      ? { implementations: implementations.baseUrls, secretName: implementations.secretName } : {};
    const played = example ? { example } : {};
    return this.http.post<WorkflowResult>(this.workflowUrl(documentId, workflowId) + '/runs',
      { inputs, timeout, ...target, validateSchema, ...played });
  }

  /**
   * Run every recorded example of a workflow, one run per example, against the mocks or the implementations.
   * @param timeout         How long a step waits for its response, in milliseconds
   * @param implementations The base URL of each linked source and the secret of the calls; none for the mocks
   * @param validateSchema  Whether each response is validated against the OpenAPI schema of its operation
   * @return How the run of each example was launched, or why it was refused
   */
  public launchExampleRuns(documentId: string, workflowId: string, timeout: number,
                           implementations?: WorkflowRunImplementations,
                           validateSchema = false): Observable<ArazzoExampleLaunch[]> {
    const target = implementations
      ? { implementations: implementations.baseUrls, secretName: implementations.secretName } : {};
    return this.http.post<ArazzoExampleLaunch[]>(this.workflowUrl(documentId, workflowId) + '/examples/runs',
      { timeout, ...target, validateSchema });
  }

  private workflowUrl(documentId: string, workflowId: string): string {
    return this.rootUrl + '/documents/' + encodeURIComponent(documentId) + '/workflows/' + encodeURIComponent(workflowId);
  }

  public getRun(runId: string): Observable<WorkflowResult> {
    return this.http.get<WorkflowResult>(this.rootUrl + '/runs/' + encodeURIComponent(runId));
  }

  /**
   * The request and response of a step of a run, stored as those of tests.
   * @param testCaseId What the step gives as its testCaseId: the id of the run and the index of the step
   */
  public getExchanges(runId: string, testCaseId: string): Observable<RequestResponsePair[]> {
    return this.http.get<RequestResponsePair[]>('/api/tests/' + encodeURIComponent(runId) + '/messages/'
      + encodeURIComponent(testCaseId));
  }
}
