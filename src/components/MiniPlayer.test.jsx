import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { Pause as PauseIcon, Play as PlayIcon } from 'lucide';
import { canonicalD } from 'morphicons/dom';
import { bubbleSecondsFromPointer } from '../playerProgress';
import { MiniPlayer } from './MiniPlayer';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

describe('MiniPlayer skip buttons', () => {
  const playerWith = queue => ({
    currentEpisode: { id: 1, title: 'A', albumPic: '', albumName: 'NIO', duration: 0 },
    queue,
    queueIndex: 0,
    positionSeconds: 0,
    durationSeconds: 0,
  });

  it('disables skips when no playable neighbor exists', () => {
    render(<MiniPlayer player={playerWith([
      { id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' },
      { id: 2, title: 'B', audioUrl: '' },
    ])} isPlaying={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: '上一首' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一首' })).toBeDisabled();
  });

  it('enables skip toward a playable neighbor, skipping unplayable ones', () => {
    render(<MiniPlayer player={playerWith([
      { id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' },
      { id: 2, title: 'B', audioUrl: '' },
      { id: 3, title: 'C', audioUrl: 'https://cdn.example/c.mp3' },
    ])} isPlaying={false} onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: '上一首' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一首' })).toBeEnabled();
  });

  it('keeps the current icon as the first frame of a play-pause morph', () => {
    const player = playerWith([{ id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' }]);
    const { container, rerender } = render(<MiniPlayer player={player} isPlaying={false} onToggle={() => {}} />);
    const iconPath = () => container.querySelector('.mini-toggle path')?.getAttribute('d');
    const playPath = iconPath();

    rerender(<MiniPlayer player={player} isPlaying onToggle={() => {}} />);

    expect(playPath).toBe(canonicalD(PlayIcon));
    expect(iconPath()).toBe(playPath);
  });

  it('settles on the pause icon after a play-pause morph', async () => {
    const player = playerWith([{ id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' }]);
    const { container, rerender } = render(<MiniPlayer player={player} isPlaying={false} onToggle={() => {}} />);
    const iconPath = () => container.querySelector('.mini-toggle path')?.getAttribute('d');

    rerender(<MiniPlayer player={player} isPlaying onToggle={() => {}} />);

    await waitFor(() => expect(iconPath()).toBe(canonicalD(PauseIcon)));
  });

  it('settles on the last requested icon after an interrupted morph', async () => {
    const player = playerWith([{ id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' }]);
    const { container, rerender } = render(<MiniPlayer player={player} isPlaying={false} onToggle={() => {}} />);
    const iconPath = () => container.querySelector('.mini-toggle path')?.getAttribute('d');

    rerender(<MiniPlayer player={player} isPlaying onToggle={() => {}} />);
    rerender(<MiniPlayer player={player} isPlaying={false} onToggle={() => {}} />);

    await waitFor(() => expect(iconPath()).toBe(canonicalD(PlayIcon)));
  });

  it('switches immediately when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const player = playerWith([{ id: 1, title: 'A', audioUrl: 'https://cdn.example/a.mp3' }]);
    const { container, rerender } = render(<MiniPlayer player={player} isPlaying={false} onToggle={() => {}} />);

    rerender(<MiniPlayer player={player} isPlaying onToggle={() => {}} />);

    expect(container.querySelector('.mini-toggle path')?.getAttribute('d')).toBe(canonicalD(PauseIcon));
  });

});
