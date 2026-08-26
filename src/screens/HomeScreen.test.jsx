import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';

afterEach(cleanup);

const episode = {
  id: 1,
  title: '第一集',
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: '',
  duration: 60000,
  onlineTime: Date.now(),
  audioUrl: 'https://cdn.example/1.aac',
};

const catalog = {
  generatedAt: Date.now(),
  albums: [{
    id: 1,
    name: 'NIO 精选',
    description: '精选内容',
    imageUrl: '',
    episodeCount: 1,
    latestEpisode: episode,
  }],
};

const player = isPlaying => ({
  currentEpisode: episode,
  isPlaying,
  queue: [episode],
  queueIndex: 0,
  positionSeconds: 0,
  durationSeconds: 60,
});

const callbacks = {
  onRetry: () => {},
  onPlay: () => {},
  onPlayAll: () => {},
  onResume: () => {},
  onTogglePlayback: () => {},
  onSearch: () => {},
  onOpenAlbums: () => {},
};

describe('HomeScreen playback control', () => {
  it('keeps the current icon as the first frame of a play-pause morph', () => {
    const { container, rerender } = render(<HomeScreen {...callbacks} catalog={catalog} player={player(false)} />);
    const iconPath = () => container.querySelector('.primary-button path')?.getAttribute('d');
    const playPath = iconPath();

    rerender(<HomeScreen {...callbacks} catalog={catalog} player={player(true)} />);

    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
    expect(playPath).toBeTruthy();
    expect(iconPath()).toBe(playPath);
  });
});
