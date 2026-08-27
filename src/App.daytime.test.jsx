import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('./catalog', async importOriginal => ({
  ...(await importOriginal()),
  loadCatalog: vi.fn(),
}));

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal()),
  getDaytimeEpisodes: vi.fn(),
}));

import App from './App';
import { getDaytimeEpisodes } from './api';
import { loadCatalog } from './catalog';
import * as iosSupport from './iosSupport';

const catalogEpisode = {
  id: 1,
  title: '目录节目',
  albumId: 1,
  albumName: '目录专辑',
  albumPic: 'https://cdn.example/catalog.jpg',
  duration: 60000,
  onlineTime: Date.now(),
  audioUrl: 'https://cdn.example/catalog.aac',
};

const catalog = {
  generatedAt: Date.now(),
  albums: [{
    id: 1,
    name: '目录专辑',
    description: '目录内容',
    imageUrl: 'https://cdn.example/catalog.jpg',
    episodeCount: 1,
    latestEpisode: catalogEpisode,
  }],
};

const daytimeEpisode = {
  id: 2,
  title: '日间节目',
  albumId: 2,
  albumName: '日间专辑',
  albumPic: 'https://cdn.example/daytime.jpg',
  duration: 120000,
  onlineTime: Date.now(),
  audioUrl: 'https://cdn.example/daytime.aac',
};

describe('daytime home playlist', () => {
  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '/');
    window.localStorage.clear();
    loadCatalog.mockReset().mockResolvedValue({ catalog, stale: false });
    getDaytimeEpisodes.mockReset();
  });

  afterEach(() => cleanup());

  it('uses the non-empty daytime list for the home queue', async () => {
    getDaytimeEpisodes.mockResolvedValue({
      episodes: [daytimeEpisode],
      date: '2026-08-27',
      schemeId: 149,
      clockId: 1,
    });
    const apply = vi.spyOn(iosSupport, 'applyEpisodeToAudio');

    const { container } = render(<App />);

    await waitFor(() => expect(screen.getAllByText('日间节目').length).toBeGreaterThan(0));
    expect(screen.getByText('目录节目')).toBeInTheDocument();
    expect([...container.querySelectorAll('.episode-row')].map(row => row.dataset.episodeId)).toEqual(['2', '1']);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));

    expect(apply).toHaveBeenCalledWith(
      expect.any(HTMLAudioElement),
      expect.objectContaining({ id: daytimeEpisode.id, title: daytimeEpisode.title }),
      expect.objectContaining({ play: true }),
    );
    expect(getDaytimeEpisodes).toHaveBeenCalledTimes(1);
    apply.mockRestore();
  });

  it('falls back to the catalog when the daytime request fails', async () => {
    getDaytimeEpisodes.mockRejectedValue(new Error('offline'));

    render(<App />);

    await waitFor(() => expect(screen.getAllByText('目录节目').length).toBeGreaterThan(0));
    expect(screen.queryByText('日间节目')).not.toBeInTheDocument();
  });

  it('falls back to the catalog when the daytime list is empty', async () => {
    getDaytimeEpisodes.mockResolvedValue({ episodes: [], date: '2026-08-27', schemeId: 149, clockId: 1 });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText('目录节目').length).toBeGreaterThan(0));
    expect(screen.queryByText('日间节目')).not.toBeInTheDocument();
  });
});
