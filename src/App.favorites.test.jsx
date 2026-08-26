import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalD } from 'morphicons/dom';
import { FILLED_HEART } from './favoriteIcon';
import App from './App';

const episode = (id, title) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: '',
  albumDesc: '',
  host: '',
  duration: 60000,
  onlineTime: Date.now(),
  audioUrl: `https://cdn.example/${id}.aac`,
});

const catalog = {
  generatedAt: Date.now(),
  albums: [
    { id: 1, name: 'NIO 精选', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(1, '第一集') },
    { id: 2, name: '另一张专辑', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(2, '第二集') },
    { id: 5, name: '资讯充电站·早间版', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(5, '早间节目') },
    { id: 23, name: '资讯充电站·晚间版', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(23, '晚间节目') },
  ],
};

function openFavorites() {
  const nav = screen.getByRole('navigation', { name: '主导航' });
  fireEvent.click(within(nav).getByRole('button', { name: '专辑收藏' }));
}

describe('desktop favorites collection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(min-width: 1024px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }));
  });

  it('shows only favorited albums in newest-first order', async () => {
    window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([5, 2]));
    render(<App initialCatalog={catalog} />);
    openFavorites();

    const cards = await screen.findAllByRole('button', { name: /^(资讯充电站·早间版|另一张专辑|NIO 精选|资讯充电站·晚间版)/ });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAccessibleName('资讯充电站·早间版早间节目');
    expect(cards[1]).toHaveAccessibleName('另一张专辑第二集');
    expect(screen.getByRole('button', { name: '取消收藏 资讯充电站·早间版' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('removes a card immediately when unfavorited', async () => {
    window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([2]));
    render(<App initialCatalog={catalog} />);
    openFavorites();
    await screen.findByRole('heading', { name: '专辑收藏' });

    fireEvent.click(screen.getByRole('button', { name: '取消收藏 另一张专辑' }));

    expect(screen.queryByRole('button', { name: /^另一张专辑/ })).not.toBeInTheDocument();
    expect(screen.getByText('还没有收藏专辑')).toBeInTheDocument();
  });

  it('toggles the star on the desktop search grid', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '搜索' }));
    await screen.findByRole('searchbox', { name: '搜索专辑' });

    const star = screen.getByRole('button', { name: '收藏 另一张专辑' });
    expect(star).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(star);
    const favorited = screen.getByRole('button', { name: '取消收藏 另一张专辑' });
    expect(favorited).toHaveAttribute('aria-pressed', 'true');
    expect(favorited).toHaveClass('is-favorite');
  });

  it('morphs only the clicked favorite icon', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(within(screen.getByRole('navigation', { name: '主导航' })).getByRole('button', { name: '搜索' }));
    await screen.findByRole('searchbox', { name: '搜索专辑' });

    const target = screen.getByRole('button', { name: '收藏 另一张专辑' });
    const untouched = screen.getByRole('button', { name: '收藏 NIO 精选' });
    const untouchedPath = untouched.querySelector('path')?.getAttribute('d');

    fireEvent.click(target);

    const favorited = await screen.findByRole('button', { name: '取消收藏 另一张专辑' });
    await waitFor(() => expect(favorited.querySelector('path')?.getAttribute('d')).toBe(canonicalD(FILLED_HEART)));
    expect(favorited.querySelector('svg')).toHaveAttribute('fill-opacity', '1');
    expect(untouched.querySelector('path')?.getAttribute('d')).toBe(untouchedPath);
  });

  it('shows the empty state and browses to the full album directory', async () => {
    render(<App initialCatalog={catalog} />);
    openFavorites();
    await screen.findByText('还没有收藏专辑');

    fireEvent.click(screen.getByRole('button', { name: '去全部专辑看看' }));
    expect(window.location.hash).toBe('#/search');
    expect(await screen.findByRole('heading', { name: '全部专辑' })).toBeInTheDocument();
  });
});
