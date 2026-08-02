import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./catalog', async importOriginal => ({
  ...(await importOriginal()),
  loadCatalog: vi.fn(),
}));

import App from './App';
import { loadCatalog } from './catalog';

const episode = {
  id: 9,
  title: '已保存节目',
  albumName: '缓存专辑',
  duration: 60000,
  audioUrl: 'https://cdn.example/9.aac',
};

describe('catalog loading shell', () => {
  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.setItem('nio_player_state_v2', JSON.stringify({
      version: 2,
      currentEpisode: episode,
      queue: [episode],
      queueIndex: 0,
      positionSeconds: 0,
      durationSeconds: 60,
      history: [],
    }));
    loadCatalog.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('keeps a restored player mounted without auto-playing while the first catalog request is pending', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play');
    render(<App />);

    expect(screen.getByText('正在准备 NIO Radio…')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '当前播放' })).toBeInTheDocument();
    expect(document.querySelector('audio')).toBeInTheDocument();
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });
});
