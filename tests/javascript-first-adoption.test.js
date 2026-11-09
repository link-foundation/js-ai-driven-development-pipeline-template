import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const readWorkflow = (name) =>
  parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));

describe('JavaScript-first adoption alongside the Rust CI/CD template', () => {
  it('requires an explicit Rust template integration decision and skips without it', () => {
    const gate = readWorkflow('javascript-first-gate');
    const input = gate.on.workflow_call.inputs['rust-template-applied'];
    expect(input?.type).toBe('boolean');
    expect(input?.required).toBe(true);
    expect(input?.default).toBeUndefined();
    expect(gate.jobs['javascript-first'].if).toBe(
      'inputs.rust-template-applied'
    );
    const caller = readWorkflow('javascript-first-example');
    expect(caller.jobs['javascript-first'].with['rust-template-applied']).toBe(
      true
    );
    // GitHub skips the prerequisite when the boolean job condition is false;
    // all downstream jobs must still require its explicit success.
    const downstream = Object.entries(caller.jobs).filter(([id]) =>
      id.startsWith('rust-')
    );
    expect(downstream.length).toBe(6);
    for (const [, job] of downstream) {
      expect(job.needs).toContain('javascript-first');
      expect(job.if).toBe("needs.javascript-first.result == 'success'");
      const checkout = job.steps.find((step) =>
        step.uses?.startsWith('actions/checkout@')
      );
      expect(checkout.with.ref).toBe(
        '${{ needs.javascript-first.outputs.tested-sha }}'
      );
    }
  });

  it('keeps standalone JavaScript CI independent of Rust template adoption', () => {
    for (const name of ['release', 'example-app', 'security', 'workflows']) {
      const workflow = readWorkflow(name);
      for (const job of Object.values(workflow.jobs)) {
        expect(job.uses ?? '').not.toContain('javascript-first-gate.yml');
        expect(job.needs ?? []).not.toContain('javascript-first');
      }
    }
  });

  it('keeps cancellable checks separate from uninterrupted repository writers', () => {
    const writers = [];
    for (const name of ['release', 'example-app']) {
      const workflow = readWorkflow(name);
      expect(workflow.concurrency).toBeUndefined();
      for (const job of Object.values(workflow.jobs)) {
        const settings = job.concurrency;
        if (settings?.group.startsWith('main-writer-')) {
          writers.push(settings.group);
          expect(settings['cancel-in-progress']).toBe(false);
          expect(settings.queue).toBe('max');
        } else if (settings) {
          expect(settings.group.startsWith('check-')).toBe(true);
        }
      }
    }
    expect(writers.length).toBe(7);
    expect(new Set(writers).size).toBe(1);
  });
});
