import { beforeEach, describe, expect, it } from 'vitest';
import {
  PLAYBACK_RATE_KEY,
  SPEED_OPTIONS,
  cycleRate,
  formatRate,
  formatSleepRemaining,
  readPlaybackRate,
  sleepDeadline,
  writePlaybackRate,
} from './playbackPrefs';

describe('playback rate', () => {
  beforeEach(() => window.localStorage.clear());

  it('cycles through speed options and wraps around', () => {
    expect(SPEED_OPTIONS).toEqual([1, 1.2, 1.5, 2]);
    expect(cycleRate(1)).toBe(1.2);
    expect(cycleRate(1.2)).toBe(1.5);
    expect(cycleRate(1.5)).toBe(2);
    expect(cycleRate(2)).toBe(1);
  });

  it('formats rates without trailing zeros', () => {
    expect(formatRate(1)).toBe('1×');
    expect(formatRate(1.2)).toBe('1.2×');
    expect(formatRate(1.5)).toBe('1.5×');
    expect(formatRate(2)).toBe('2×');
  });

  it('persists the rate in localStorage', () => {
    expect(readPlaybackRate()).toBe(1);
    writePlaybackRate(1.5);
    expect(readPlaybackRate()).toBe(1.5);
    expect(window.localStorage.getItem(PLAYBACK_RATE_KEY)).toBe('1.5');
  });

  it('falls back to 1 for unknown stored values', () => {
    window.localStorage.setItem(PLAYBACK_RATE_KEY, '3');
    expect(readPlaybackRate()).toBe(1);
  });
});

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
