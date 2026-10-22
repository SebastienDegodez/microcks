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
import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';

import { parseReadableSpan } from '../../../utils/otel-parser';
import { TraceGroupListComponent } from './trace-group-list.component';

@Component({ standalone: true, template: '' })
class RunPageStub {}

/**
 * A trace of a REST mock invocation as /api/traces gives it: the server span, carrying the attributes Microcks sets and
 * the invocation_received event, then the span of the processing.
 */
function trace(traceId: string, attributes: Record<string, unknown>): ReadableSpan[] {
  return [
    parseReadableSpan({
      traceId, spanId: 'span-1', name: 'GET /rest/{service}/{version}/**',
      startEpochNanos: 1758824048000000000, endEpochNanos: 1758824048010000000,
      attributes: { 'explain-trace': true, 'service.name': 'API Pastry - 2.0', 'service.version': '2.0.0',
        'operation.name': 'GET /pastry/{name}', ...attributes },
      events: [{ name: 'invocation_received', epochNanos: 1758824048001000000,
        attributes: { message: 'Received REST invocation GET /rest/API+Pastry+-+2.0/2.0.0/pastry/Eclair%20Cafe',
          'http.method': 'GET', ...attributes } }]
    }),
    parseReadableSpan({
      traceId, spanId: 'span-2', parentSpanId: 'span-1', name: 'processInvocation',
      startEpochNanos: 1758824048002000000, endEpochNanos: 1758824048009000000,
      attributes: { 'explain-trace': true }, events: []
    })
  ];
}

const READ_PASTRY = { 'arazzo.run.id': '6719f0c2a1b2c3d4e5f60718', 'arazzo.workflow.id': 'readThenReprice',
  'arazzo.step.id': 'readPastry', 'arazzo.attempt': 2, 'arazzo.via': 'run' };

describe('TraceGroupListComponent', () => {
  let fixture: ComponentFixture<TraceGroupListComponent>;

  function show(...traces: ReadableSpan[][]): void {
    TestBed.configureTestingModule({
      imports: [TraceGroupListComponent],
      providers: [provideRouter([{ path: 'workflows/runs/:runId', component: RunPageStub }])]
    });
    fixture = TestBed.createComponent(TraceGroupListComponent);
    fixture.componentRef.setInput('traces', traces);
    fixture.detectChanges();
  }

  function headers(): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.trace-header'));
  }

  function text(element: Element | null): string {
    return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('says which workflow, step and attempt of an Arazzo run a trace comes from, with a link to the run', () => {
    show(trace('trace-1', READ_PASTRY));

    const arazzo = headers()[0].querySelector('.trace-arazzo');
    expect(text(arazzo?.querySelector('.trace-arazzo-chip') ?? null)).toBe('Arazzo');
    expect(text(arazzo?.querySelector('.trace-arazzo-origin') ?? null))
      .toBe('readThenReprice · readPastry · attempt 2');
    const link = arazzo?.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/workflows/runs/6719f0c2a1b2c3d4e5f60718');
    expect(text(link)).toBe('View run');
    expect(link.title).toBe('Open run 6719f0c2a1b2c3d4e5f60718 of readThenReprice');
  });

  it('leaves the other traces as they are', () => {
    show(trace('trace-1', READ_PASTRY), trace('trace-2', {}));

    expect(headers().map(header => header.querySelector('.trace-arazzo') !== null)).toEqual([true, false]);
    expect(text(headers()[1])).not.toContain('Arazzo');
  });

  it('shows what the baggage of the call names when it names only its run', () => {
    show(trace('trace-1', { 'arazzo.run.id': 'run-1', 'arazzo.via': 'run' }),
      trace('trace-2', { 'arazzo.run.id': 'run-2', 'arazzo.workflow.id': 'readThenReprice', 'arazzo.via': 'run' }));

    expect(headers().map(header => text(header.querySelector('.trace-arazzo-origin'))))
      .toEqual(['', 'readThenReprice']);
    expect(headers().map(header => header.querySelector('.trace-arazzo a')?.getAttribute('href')))
      .toEqual(['/workflows/runs/run-1', '/workflows/runs/run-2']);
  });

  it('opens the run without opening or closing the trace', fakeAsync(() => {
    show(trace('trace-1', READ_PASTRY));

    (headers()[0].querySelector('.trace-arazzo a') as HTMLAnchorElement).click();
    tick();
    fixture.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/workflows/runs/6719f0c2a1b2c3d4e5f60718');
    expect((fixture.nativeElement as HTMLElement).querySelector('.trace-body')).toBeNull();
  }));

  it('still opens a trace of an Arazzo run on a click of its header, showing the Arazzo attributes of its event', () => {
    show(trace('trace-1', READ_PASTRY));

    headers()[0].click();
    fixture.detectChanges();

    const attributes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.trace-body ul.kv li'))
      .map(item => text(item.querySelector('.k')) + ' ' + text(item.querySelector('.v')));
    expect(attributes).toContain('arazzo.run.id 6719f0c2a1b2c3d4e5f60718');
    expect(attributes).toContain('arazzo.attempt 2');
  });
});
