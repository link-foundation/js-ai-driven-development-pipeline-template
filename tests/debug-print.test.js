import { describe, it, expect } from 'test-anywhere';

import { debug, isDebugEnabled } from '../scripts/debug-print.mjs';

describe('debug-print', () => {
  it('stays off by default', () => {
    expect(isDebugEnabled({})).toBe(false);
  });

  it('honours each documented activation switch', () => {
    expect(isDebugEnabled({ CI_SCRIPTS_DEBUG: '1' })).toBe(true);
    expect(isDebugEnabled({ CI_SCRIPTS_DEBUG: 'true' })).toBe(true);
    expect(isDebugEnabled({ RUNNER_DEBUG: '1' })).toBe(true);
    expect(isDebugEnabled({ ACTIONS_STEP_DEBUG: 'true' })).toBe(true);
  });

  it('ignores unrelated values', () => {
    expect(isDebugEnabled({ CI_SCRIPTS_DEBUG: '0' })).toBe(false);
    expect(isDebugEnabled({ RUNNER_DEBUG: 'false' })).toBe(false);
  });

  it('prints nothing while disabled', () => {
    const original = console.log;
    const lines = [];
    console.log = (line) => lines.push(line);
    try {
      delete process.env.CI_SCRIPTS_DEBUG;
      debug('should not appear');
    } finally {
      console.log = original;
    }
    expect(lines).toEqual([]);
  });

  it('prefixes every line with ::debug:: while enabled', () => {
    const original = console.log;
    const lines = [];
    console.log = (line) => lines.push(line);
    try {
      process.env.CI_SCRIPTS_DEBUG = '1';
      debug('shape', { keys: ['default'] });
    } finally {
      console.log = original;
      delete process.env.CI_SCRIPTS_DEBUG;
    }
    expect(lines.length > 1).toBe(true);
    expect(lines.every((line) => line.startsWith('::debug::'))).toBe(true);
    expect(lines[0]).toBe('::debug::shape {');
  });
});
