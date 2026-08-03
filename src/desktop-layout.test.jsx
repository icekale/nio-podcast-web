import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  ],
};

describe('desktop navigation', () => {
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

  it('shows the desktop nav with the home destination active', () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: '今日推荐' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: '全部专辑' })).not.toHaveAttribute('aria-current');
  });

  it('highlights the active sidebar destination', async () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    fireEvent.click(within(nav).getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    expect(within(nav).getByRole('button', { name: '全部专辑' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: '今日推荐' })).not.toHaveAttribute('aria-current');
  });

  it('opens the later tab from the sidebar', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(screen.getByRole('button', { name: '稍后播放' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    expect(screen.getByRole('tab', { name: '稍后播放' })).toHaveAttribute('aria-selected', 'true');
    expect(dialog).toBeInTheDocument();
  });
});
