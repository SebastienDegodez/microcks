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
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BsModalService } from 'ngx-bootstrap/modal';
import { EMPTY, Observable, of, throwError } from 'rxjs';

import { NotificationService } from '../../../components/patternfly-ng/notification';
import { ArazzoApiUsage } from '../../../models/arazzo-api-usage.model';
import { Operation, ServiceType, ServiceView } from '../../../models/service.model';
import { AICopilotService } from '../../../services/aicopilot.service';
import { ArazzoWorkflowService } from '../../../services/arazzo-workflow.service';
import { IAuthenticationService } from '../../../services/auth.service';
import { ConfigService } from '../../../services/config.service';
import { ContractsService } from '../../../services/contracts.service';
import { MetricsService } from '../../../services/metrics.service';
import { ServicesService } from '../../../services/services.service';
import { ServiceDetailPageComponent } from './service-detail.page';

describe('ServiceDetailPageComponent formatCurlCmd', () => {
  function createComponentForCurl(): ServiceDetailPageComponent {
    const component = Object.create(ServiceDetailPageComponent.prototype) as ServiceDetailPageComponent;

    (component as any).resolvedServiceView = {
      service: {
        type: ServiceType.REST,
        name: 'OpenAI API Documentation',
        version: '1.0.0'
      }
    };

    (component as any).formatMockUrl = () =>
      'http://localhost:9090/rest/OpenAI+API+Documentation/1.0.0/providers/openai/deployments/gpt-4o/chat/completions?api-version=2024-06-01';

    return component;
  }

  function extractAndParseCurlBody(cmd: string): unknown {
    const match = cmd.match(/ -d '([\s\S]*)'$/);
    expect(match).withContext('curl command should contain a single-quoted -d payload').not.toBeNull();

    // The generated body escapes apostrophes using POSIX shell pattern: '\''
    const payload = match![1].replace(/'\\''/g, "'");
    return JSON.parse(payload);
  }

  it('should generate a curl body that remains valid JSON when content contains apostrophes', () => {
    const component = createComponentForCurl();

    const operation: any = { method: 'POST' };
    const exchange: any = {
      request: {
        queryParameters: null,
        headers: [{ name: 'Content-Type', values: ['application/json'] }],
        content: '{"text":"Tu es un assistant d\'extraction de donnees"}'
      },
      response: { dispatchCriteria: null }
    };

    const cmd = component.formatCurlCmd(operation, exchange);

    expect(cmd).toContain("-d '{\"text\":\"Tu es un assistant d'\\''extraction de donnees\"}'");
    expect(extractAndParseCurlBody(cmd)).toEqual({
      text: "Tu es un assistant d'extraction de donnees"
    });
  });
});

/** API Pastry - 2.0, as GET /api/services/{serviceId} answers it, with its number of samples per operation. */
function apiPastry(): ServiceView {
  const operation = (name: string): Operation => ({ name, method: name.split(' ')[0] } as Operation);
  return {
    service: {
      id: 'svc-1', name: 'API Pastry - 2.0', version: '2.0.0', type: ServiceType.REST,
      operations: [operation('GET /pastry'), operation('GET /pastry/{name}'), operation('PATCH /pastry/{name}')]
    },
    messagesMap: { 'GET /pastry': [{}], 'GET /pastry/{name}': [{}, {}, {}], 'PATCH /pastry/{name}': [{}, {}] }
  } as unknown as ServiceView;
}

/** The workflows of API Pastry scenarios 1.0.0 using API Pastry - 2.0, as GET /api/arazzo/services/svc-1/workflows answers it. */
function pastryScenariosUsage(): ArazzoApiUsage {
  return {
    documents: [{
      id: 'doc-1', title: 'API Pastry scenarios', version: '1.0.0',
      workflows: [
        { workflowId: 'readThenReprice', lastResult: 'NEVER_RUN' },
        { workflowId: 'listThenReadFirst', lastResult: 'NEVER_RUN' }
      ]
    }],
    operationWorkflowCounts: { 'GET /pastry': 1, 'GET /pastry/{name}': 2, 'PATCH /pastry/{name}': 1 }
  };
}

describe('ServiceDetailPageComponent Arazzo workflows', () => {
  let page: HTMLElement;
  let arazzoWorkflowService: { getApiUsage: jasmine.Spy };

  async function open(usage: Observable<ArazzoApiUsage>): Promise<void> {
    arazzoWorkflowService = { getApiUsage: jasmine.createSpy('getApiUsage').and.returnValue(usage) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'services/:serviceId', component: ServiceDetailPageComponent }]),
        { provide: ServicesService, useValue: { getServiceView: () => of(apiPastry()) } },
        { provide: ContractsService, useValue: { listByServiceId: () => of([]) } },
        { provide: MetricsService, useValue: { getServiceTestConformanceMetric: () => EMPTY } },
        { provide: IAuthenticationService, useValue: { hasRole: () => false, hasRoleForResource: () => false } },
        { provide: ConfigService, useValue: { hasFeatureEnabled: () => false, getFeatureProperty: () => '' } },
        { provide: AICopilotService, useValue: {} },
        { provide: BsModalService, useValue: {} },
        { provide: NotificationService, useValue: { getNotifications: () => [] } },
        { provide: ArazzoWorkflowService, useValue: arazzoWorkflowService }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/services/svc-1', ServiceDetailPageComponent);
    harness.detectChanges();
    page = harness.routeNativeElement as HTMLElement;
  }

  function normalized(text: string | null): string {
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  function properties(): string[] {
    return Array.from(page.querySelectorAll('dl.dl-horizontal > dt, dl.dl-horizontal > span > dt'))
      .map(term => normalized(term.textContent));
  }

  function workflowsProperty(): HTMLElement | null {
    const term = Array.from(page.querySelectorAll('dl.dl-horizontal > dt'))
      .find(candidate => normalized(candidate.textContent) === 'Workflows:');
    return (term?.nextElementSibling as HTMLElement) ?? null;
  }

  function operationCounts(): string[] {
    return Array.from(page.querySelectorAll('#operationsList .list-pf-additional-content'))
      .map(counts => normalized(counts.textContent));
  }

  it('lists under Properties the workflows using the API, with their last result and a link to the Workflows page', async () => {
    await open(of(pastryScenariosUsage()));

    expect(arazzoWorkflowService.getApiUsage).toHaveBeenCalledWith('svc-1');
    expect(properties()).toEqual(['Service Type:', 'Contracts:', 'Statistics:', 'Workflows:', 'MCP Server:']);
    const workflows = workflowsProperty()!;
    expect(Array.from(workflows.querySelectorAll('a')).map(link => normalized(link.textContent)))
      .toEqual(['readThenReprice', 'listThenReadFirst', 'View Workflows']);
    expect(normalized(workflows.textContent)).toMatch(/listThenReadFirst\s*in API Pastry scenarios 1\.0\.0 · View Workflows$/);
    expect(Array.from(workflows.querySelectorAll('[role="img"]'))
      .map(result => result.getAttribute('aria-label') + ' (' + result.getAttribute('title') + ')'))
      .toEqual(['Never run (Never run)', 'Never run (Never run)']);
    expect(Array.from(workflows.querySelectorAll('a')).map(link => link.getAttribute('href')))
      .toEqual(['/workflows/doc-1/readThenReprice', '/workflows/doc-1/listThenReadFirst', '/workflows']);
  });

  it('shows next to the sample(s) count of each operation how many workflows call it', async () => {
    await open(of(pastryScenariosUsage()));

    expect(operationCounts()).toEqual([
      '1 workflow(s) 1 sample(s)',
      '2 workflow(s) 3 sample(s)',
      '1 workflow(s) 2 sample(s)'
    ]);
  });

  it('only counts the workflows calling an operation, on the operations some workflow calls', async () => {
    const usage = pastryScenariosUsage();
    usage.operationWorkflowCounts = { 'GET /pastry/{name}': 1 };
    await open(of(usage));

    expect(operationCounts()).toEqual(['1 sample(s)', '1 workflow(s) 3 sample(s)', '2 sample(s)']);
  });

  it('leaves the page unchanged when no workflow uses the API', async () => {
    await open(of({ documents: [], operationWorkflowCounts: {} }));

    expect(properties()).toEqual(['Service Type:', 'Contracts:', 'Statistics:', 'MCP Server:']);
    expect(operationCounts()).toEqual(['1 sample(s)', '3 sample(s)', '2 sample(s)']);
    expect(normalized(page.textContent)).not.toContain('workflow');
  });

  it('leaves the page unchanged when the workflows using the API cannot be read', async () => {
    await open(throwError(() => new Error('Http failure response: 500')));

    expect(properties()).toEqual(['Service Type:', 'Contracts:', 'Statistics:', 'MCP Server:']);
    expect(operationCounts()).toEqual(['1 sample(s)', '3 sample(s)', '2 sample(s)']);
  });
});
