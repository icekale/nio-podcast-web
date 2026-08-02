import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

const episode = (id, title, onlineTime = Date.now()) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: 'https://cdn.example/cover.jpg',
  albumDesc: '精选内容',
  host: 'NIO Radio',
  duration: 60000,
  onlineTime,
  audioUrl: `https://cdn.example/${id}.aac`,
});

const catalog = {
  generatedAt: Date.now(),
  albums: [
    { id: 1, name: 'NIO 精选', description: '精选内容', imageUrl: 'https://cdn.example/cover.jpg', episodeCount: 2, latestEpisode: episode(1, '第一集') },
    { id: 2, name: '另一张专辑', description: '更多内容', imageUrl: 'https://cdn.example/cover-2.jpg', episodeCount: 1, latestEpisode: episode(2, '第二集') },
  ],
};

describe('mobile app shell', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.location.hash = '#/';
    window.localStorage.clear();
  });

  it('shows the recommendation and starts all visible episodes', async () => {
    render(<App initialCatalog={catalog} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    expect(screen.getAllByText('第一集').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    expect(await screen.findByRole('button', { name: '打开播放列表' })).toBeInTheDocument();
    expect(screen.getAllByText('第一集').length).toBeGreaterThan(0);
  });

  it('keeps the player mounted when media events update playback state', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 15 });

    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);

    expect(await screen.findByRole('button', { name: '打开播放列表' })).toBeInTheDocument();
  });

  it('opens the queue in place, switches tabs, and closes through the backdrop', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));

    expect(await screen.findByRole('dialog', { name: '播放列表' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '最近听过' }));
    expect(screen.getByRole('tab', { name: '最近听过' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: '关闭播放列表' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
    expect(window.location.hash).toBe('#/');
  });

  it('lets browser Back close the sheet before changing the route', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    expect(window.location.hash).toBe('#/?queue=1');

    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
  });
});
