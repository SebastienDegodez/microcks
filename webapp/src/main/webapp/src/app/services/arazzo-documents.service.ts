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

import { ArazzoDocumentSummary } from '../models/arazzo-document.model';

@Injectable({ providedIn: 'root' })
export class ArazzoDocumentsService {
  private rootUrl = '/api/arazzo';

  constructor(private http: HttpClient) {}

  /**
   * List the imported Arazzo documents with their APIs and workflows.
   * @param api The name of an API to list only the documents using it; every document when absent
   */
  public getDocuments(api?: string): Observable<ArazzoDocumentSummary[]> {
    let params = new HttpParams();
    if (api) {
      params = params.set('api', api);
    }
    return this.http.get<ArazzoDocumentSummary[]>(this.rootUrl + '/documents', { params });
  }
}
