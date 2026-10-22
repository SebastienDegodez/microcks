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

import { ArazzoDocumentSummary, ArazzoImportAnalysis, ArazzoSourceLinks } from '../models/arazzo-document.model';

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

  /**
   * Analyse an Arazzo document before importing it; nothing is stored.
   * @param content The document, in YAML or JSON
   * @param links The API each source description is linked to; absent to link each one to the API it is matched to
   */
  public analyseDocument(content: string, links?: ArazzoSourceLinks): Observable<ArazzoImportAnalysis> {
    return this.http.post<ArazzoImportAnalysis>(this.rootUrl + '/documents/analysis', { content, links });
  }

  /**
   * Import an Arazzo document with the links of its source descriptions, all or nothing.
   * @param content The document, in YAML or JSON
   * @param fileName The name of the file the document was dropped from
   * @param links The API each source description is linked to
   */
  public importDocument(content: string, fileName: string, links: ArazzoSourceLinks): Observable<ArazzoDocumentSummary> {
    return this.http.post<ArazzoDocumentSummary>(this.rootUrl + '/documents', { content, fileName, links });
  }

  /**
   * Analyse the links of the source descriptions of an imported Arazzo document, to link them again; nothing is stored.
   * @param documentId The identifier of the imported document
   * @param links The API each source description is linked to; absent for the links of its overlay, completed with the
   * API matched for a source the overlay does not link
   */
  public analyseImportedDocument(documentId: string, links?: ArazzoSourceLinks): Observable<ArazzoImportAnalysis> {
    return this.http.post<ArazzoImportAnalysis>(this.rootUrl + '/documents/' + documentId + '/analysis', { links });
  }

  /**
   * Link the source descriptions of an imported Arazzo document again, replacing the sources of its overlay.
   * @param documentId The identifier of the imported document
   * @param links The API each source description is linked to
   */
  public relinkSources(documentId: string, links: ArazzoSourceLinks): Observable<ArazzoDocumentSummary> {
    return this.http.put<ArazzoDocumentSummary>(this.rootUrl + '/documents/' + documentId + '/sources', { links });
  }
}
