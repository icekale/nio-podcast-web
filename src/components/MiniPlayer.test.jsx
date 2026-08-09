import { describe, expect, it } from 'vitest';
import { bubbleSecondsFromPointer } from './MiniPlayer';

describe('bubbleSecondsFromPointer', () => {
  it('maps pointer x within the track to seconds', () => {
    // track 从 x=100 到 x=500（宽 400），duration 200s；x=300 即 50% → 100s
    expect(bubbleSecondsFromPointer(300, 100, 400, 200)).toBe(100);
  });

  it('clamps positions left of the track to zero', () => {
    expect(bubbleSecondsFromPointer(50, 100, 400, 200)).toBe(0);
  });

  it('clamps positions right of the track to the duration', () => {
    expect(bubbleSecondsFromPointer(900, 100, 400, 200)).toBe(200);
  });

  it('returns zero for empty duration', () => {
    expect(bubbleSecondsFromPointer(300, 100, 400, 0)).toBe(0);
    expect(bubbleSecondsFromPointer(300, 100, 400, NaN)).toBe(0);
  });
});
