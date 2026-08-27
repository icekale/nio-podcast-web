import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./catalog', async importOriginal => ({
  ...(await importOriginal()),
  loadCatalog: vi.fn(),
}));

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal()),
  getDaytimeEpisodes: vi.fn().mockResolvedValue({ episodes: [] }),
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
    window.history.replaceState({ nioDepth: 0 }, '', '/');
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

  it('refreshes the catalog once when the document returns to the foreground', async () => {
    const now = 1_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1 } }] };
    const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2 } }] };
    loadCatalog.mockReset();
    loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });

    render(<App />);
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
    nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2));
    nowSpy.mockRestore();
  });

  it('refreshes stale home summaries when the document returns to the foreground', async () => {
    const now = 1_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
    const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
    loadCatalog.mockReset();
    loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });

    render(<App />);
    await waitFor(() => expect(screen.getAllByText('旧节目').length).toBeGreaterThan(0));
    nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(screen.getAllByText('新节目').length).toBeGreaterThan(0));
    expect(loadCatalog).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('refreshes the all-albums subtitle when navigation finds a stale catalog', async () => {
    const now = 1_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
    const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
    loadCatalog.mockReset();
    loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockResolvedValueOnce({ catalog: newerCatalog, stale: false });

    render(<App />);
    await waitFor(() => expect(screen.getAllByText('旧节目').length).toBeGreaterThan(0));
    nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));

    await waitFor(() => expect(screen.getAllByText('新节目').length).toBeGreaterThan(0));
    expect(loadCatalog).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it('deduplicates concurrent automatic catalog refreshes', async () => {
    const now = 1_000;
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
    const newerCatalog = { generatedAt: 2, albums: [{ id: 1, name: '目录', latestEpisode: { id: 99, title: '新节目', onlineTime: 2, duration: 60000 } }] };
    let resolveRefresh;
    const pendingRefresh = new Promise(resolve => { resolveRefresh = () => resolve({ catalog: newerCatalog, stale: false }); });
    loadCatalog.mockReset();
    loadCatalog.mockResolvedValueOnce({ catalog, stale: false }).mockReturnValueOnce(pendingRefresh);

    render(<App />);
    await waitFor(() => expect(screen.getAllByText('旧节目').length).toBeGreaterThan(0));
    nowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(2));
    resolveRefresh();

    await waitFor(() => expect(screen.getAllByText('新节目').length).toBeGreaterThan(0));
    nowSpy.mockRestore();
  });

  it('does not poll the catalog while the document is hidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const catalog = { generatedAt: 1, albums: [{ id: 1, name: '目录', latestEpisode: { id: 1, title: '旧节目', onlineTime: 1, duration: 60000 } }] };
    loadCatalog.mockReset().mockResolvedValue({ catalog, stale: false });

    render(<App />);
    await waitFor(() => expect(loadCatalog).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(loadCatalog).toHaveBeenCalledTimes(1);

    if (visibility) Object.defineProperty(document, 'visibilityState', visibility);
    vi.useRealTimers();
  });
});
