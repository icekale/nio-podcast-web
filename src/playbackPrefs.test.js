import { describe, expect, it } from 'vitest';
import { sleepDeadline } from './playbackPrefs';

describe('sleep timer', () => {
  it('computes a deadline from minutes', () => {
    const before = Date.now() + 15 * 60 * 1000;
    const deadline = sleepDeadline(15);
    expect(deadline).toBeGreaterThanOrEqual(before);
    expect(deadline - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 50);
  });
});
