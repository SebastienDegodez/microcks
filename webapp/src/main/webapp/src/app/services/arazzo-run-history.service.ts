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
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { WorkflowRunCounts, WorkflowRunFilter, WorkflowRunSummary } from '../models/arazzo-run.model';

/** Reads the runs history of the workflows of an Arazzo document, newest first. */
@Injectable({ providedIn: 'root' })
export class ArazzoRunHistoryService {

  private rootUrl = '/api/arazzo';

  constructor(private http: HttpClient) { }

  /**
   * @param filter The filters the runs match
   * @param page   The page to read, from 1 like the pagination of Microcks pages
   * @param size   The number of runs in a page
   */
  public getRuns(documentId: string, filter: WorkflowRunFilter, page = 1, size = 20): Observable<WorkflowRunSummary[]> {
    const params = this.filterParams(filter).set('page', page - 1).set('size', size);
    return this.http.get<WorkflowRunSummary[]>(this.runsUrl(documentId), { params });
  }

  public countRuns(documentId: string, filter: WorkflowRunFilter): Observable<WorkflowRunCounts> {
    return this.http.get<WorkflowRunCounts>(this.runsUrl(documentId) + '/count', { params: this.filterParams(filter) });
  }

  private runsUrl(documentId: string): string {
    return this.rootUrl + '/documents/' + encodeURIComponent(documentId) + '/runs';
  }

  private filterParams(filter: WorkflowRunFilter): HttpParams {
    let params = new HttpParams();
    Object.entries(filter).filter(([, value]) => value).forEach(([name, value]) => params = params.set(name, value));
    return params;
  }
}
