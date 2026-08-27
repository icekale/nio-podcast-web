import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api', () => ({ getEpisodes: vi.fn(), getDaytimeEpisodes: vi.fn() }));

import { getEpisodes } from './api';
import App from './App';

const catalog = {
  generatedAt: 1,
  albums: [{
    id: 1,
    name: '测试专辑',
    description: '测试',
    imageUrl: '',
    episodeCount: 60,
    latestEpisode: { id: 1, title: '第一集', onlineTime: Date.now(), duration: 60000, audioUrl: 'https://cdn.example/1.aac' },
  }],
};

describe('album pagination', () => {
  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '/');
    getEpisodes.mockReset();
  });

  afterEach(cleanup);

  it('loads additional pages until a shared episode is found', async () => {
    window.history.replaceState({ nioDepth: 0 }, '', '/album/1?ep=2');
    getEpisodes.mockImplementation((_albumId, page) => Promise.resolve(page === 1
      ? { episodes: [{ id: 1, title: '第一集', duration: 60000, audioUrl: 'https://cdn.example/1.aac' }], hasMore: true }
      : { episodes: [{ id: 2, title: '第二集', duration: 60000, audioUrl: 'https://cdn.example/2.aac' }], hasMore: false }));

    render(<App initialCatalog={catalog} />);

    await waitFor(() => expect(screen.getByText('第二集')).toBeInTheDocument());
    expect(getEpisodes.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
  });

  it('stops automatic deep-link lookup after ten pages', async () => {
    window.history.replaceState({ nioDepth: 0 }, '', '/album/1?ep=999999');
    getEpisodes.mockImplementation((_albumId, page) => Promise.resolve({
      episodes: [{ id: page, title: `第${page}集`, duration: 60000, audioUrl: `https://cdn.example/${page}.aac` }],
      hasMore: page < 11,
    }));

    render(<App initialCatalog={catalog} />);

    await waitFor(() => expect(getEpisodes).toHaveBeenCalledTimes(10));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(getEpisodes).toHaveBeenCalledTimes(10);
    expect(screen.getByRole('button', { name: '加载更多' })).toBeInTheDocument();
  });

  it('retries the failed page instead of the last successful page', async () => {
    getEpisodes.mockImplementation((_albumId, page) => {
      if (page === 1) return Promise.resolve({ episodes: [{ id: 1, title: '第一集', duration: 60000, audioUrl: 'https://cdn.example/1.aac' }], hasMore: true });
      if (getEpisodes.mock.calls.filter(([, requestedPage]) => requestedPage === 2).length === 1) return Promise.reject(new Error('temporary failure'));
      return Promise.resolve({ episodes: [{ id: 2, title: '第二集', duration: 60000, audioUrl: 'https://cdn.example/2.aac' }], hasMore: false });
    });

    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: '测试专辑第一集' }));
    await screen.findByText('第一集');
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await screen.findByRole('button', { name: '重新加载' });

    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    await waitFor(() => expect(screen.getByText('第二集')).toBeInTheDocument());
    expect(getEpisodes.mock.calls.map(([, page]) => page)).toEqual([1, 2, 2]);
  });
});
