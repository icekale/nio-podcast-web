import { describe, expect, it } from 'vitest';
import { formatSleepRemaining, sleepDeadline } from './playbackPrefs';

describe('sleep timer', () => {
  it('computes a deadline from minutes', () => {
    const before = Date.now() + 15 * 60 * 1000;
    const deadline = sleepDeadline(15);
    expect(deadline).toBeGreaterThanOrEqual(before);
    expect(deadline - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 50);
  });

  it('formats remaining time in minutes and hours', () => {
    expect(formatSleepRemaining(Date.now() + 5 * 60 * 1000)).toBe('5 分钟');
    expect(formatSleepRemaining(Date.now() + 90 * 60 * 1000)).toBe('1 小时 30 分');
    expect(formatSleepRemaining(Date.now() - 1000)).toBe('0 分钟');
  });
});
