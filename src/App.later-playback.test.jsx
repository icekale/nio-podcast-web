import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';
vi.mock('./api', async importOriginal => ({ ...(await importOriginal()), getEpisodes: vi.fn() }));
import { getEpisodes } from './api';
import App from './App';

const episode = (id, title = `第${id}集`) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: 'https://cdn.example/cover.jpg',
  albumDesc: '精选内容',
  host: 'NIO Radio',
  duration: 60000,
  onlineTime: Date.now() - id * 1000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

const catalog = {
  generatedAt: Date.now(),
  albums: [
    { id: 1, name: 'NIO 精选', description: '精选内容', imageUrl: 'https://cdn.example/cover.jpg', episodeCount: 2, latestEpisode: episode(1, '第一集') },
    { id: 2, name: '另一张专辑', description: '更多内容', imageUrl: 'https://cdn.example/cover-2.jpg', episodeCount: 1, latestEpisode: episode(2, '第二集') },
  ],
};

describe('later playback integration', () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.clear();
    getEpisodes.mockReset();
  });

  it('removes a later episode after natural playback ends', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.ended(document.querySelector('audio'));

    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    expect(within(dialog).queryByText('第一集')).not.toBeInTheDocument();
    expect(within(dialog).getByText('第二集')).toBeInTheDocument();
  });

  it('starts later playback at the selected item and keeps following items', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集'), episode(3, '第三集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('button', { name: '第二集' }));

    await waitFor(() => expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第二集'));
  });

  it('shows an empty later state and opens the add-program picker', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));

    expect(within(dialog).getByText('稍后播放是空的')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '添加节目' }));
    expect(within(dialog).getByRole('heading', { name: '添加节目' })).toBeInTheDocument();
  });

  it('browses albums and adds an episode without leaving the picker', async () => {
    getEpisodes.mockResolvedValue({ episodes: [episode(4, '待添加节目')], hasMore: false });
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '添加节目' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '选择专辑 NIO 精选' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: '添加 待添加节目 到稍后播放' }));

    expect(within(dialog).getByText('已添加到稍后播放')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '返回稍后播放' })).toBeInTheDocument();
  });

  it('shows a duplicate notice and keeps one later item', async () => {
    getEpisodes.mockResolvedValue({ episodes: [episode(4, '待添加节目')], hasMore: false });
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(4, '待添加节目')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '添加节目' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '选择专辑 NIO 精选' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: '添加 待添加节目 到稍后播放' }));

    expect(within(dialog).getByText('已在稍后播放')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('nio_play_later_v1'))).toHaveLength(1);
  });
});
