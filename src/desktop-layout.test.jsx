import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    { id: 2, name: '另一张专辑', description: '', imageUrl: '', episodeCount: 1, latestEpisode: episode(2, '第二集') },
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
    expect(within(nav).getByRole('button', { name: '搜索' })).not.toHaveAttribute('aria-current');
    expect(within(nav).queryByRole('button', { name: '全部专辑' })).not.toBeInTheDocument();
  });

  it('highlights the active sidebar destination', async () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    fireEvent.click(within(nav).getByRole('button', { name: '搜索' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    expect(within(nav).getByRole('button', { name: '搜索' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: '今日推荐' })).not.toHaveAttribute('aria-current');
  });

  it('highlights search when the album route is open', () => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/albums');
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    expect(within(nav).getByRole('button', { name: '搜索' })).toHaveAttribute('aria-current', 'page');
  });

  it('browses and filters the album grid from search', async () => {
    render(<App initialCatalog={catalog} />);
    const nav = screen.getByRole('navigation', { name: '主导航' });
    fireEvent.click(within(nav).getByRole('button', { name: '搜索' }));
    const searchbox = await screen.findByRole('searchbox', { name: '搜索专辑' });
    expect(screen.getByRole('button', { name: /NIO 精选/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /另一张专辑/ })).toBeInTheDocument();

    fireEvent.change(searchbox, { target: { value: 'NIO' } });
    expect(await screen.findByRole('button', { name: /NIO 精选/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /另一张专辑/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '清空搜索' }));
    expect(await screen.findByRole('button', { name: /另一张专辑/ })).toBeInTheDocument();
  });

  it('shows and triggers the install button from beforeinstallprompt', async () => {
    render(<App initialCatalog={catalog} />);
    expect(screen.queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument();

    const event = new Event('beforeinstallprompt', { cancelable: true });
    const prompt = vi.fn(() => Promise.resolve());
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    await screen.findByRole('button', { name: '安装应用' });

    fireEvent.click(screen.getByRole('button', { name: '安装应用' }));
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument());
  });

  it('hides the install button after appinstalled', async () => {
    render(<App initialCatalog={catalog} />);
    window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }));
    await screen.findByRole('button', { name: '安装应用' });

    window.dispatchEvent(new Event('appinstalled'));
    await waitFor(() => expect(screen.queryByRole('button', { name: '安装应用' })).not.toBeInTheDocument());
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
