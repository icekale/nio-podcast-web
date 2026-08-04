import { describe, expect, it } from 'vitest';
import { formatClock, formatDate, formatDuration } from '../utils/format';

describe('format helpers', () => {
  it('formats durations as h:mm:ss or m:ss', () => {
    expect(formatDuration(253000)).toBe('4:13');
    expect(formatDuration(11172000)).toBe('3:06:12');
    expect(formatDuration(-1)).toBe('--:--');
  });
  it('formats clock seconds', () => {
    expect(formatClock(146)).toBe('2:26');
    expect(formatClock(0)).toBe('0:00');
  });
  it('formats M/D dates', () => {
    expect(formatDate(new Date(2026, 7, 2).getTime())).toBe('8/2');
    expect(formatDate(Number.NaN)).toBe('');
  });
});
