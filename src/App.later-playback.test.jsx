import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { within } from '@testing-library/react';
vi.mock('./api', async importOriginal => ({ ...(await importOriginal()), getEpisodes: vi.fn() }));
import { getEpisodes } from './api';
import App from './App';
import { PLAYER_STORAGE_KEY, createPlayerState, selectEpisode, serializePlayerState } from './playerState';

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
  afterEach(() => vi.useRealTimers());

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

  it('keeps the swipe remove action out of keyboard order until revealed', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const remove = dialog.querySelector('.later-swipe-action');

    expect(remove).toHaveAttribute('tabindex', '-1');
    expect(remove).toHaveAttribute('aria-hidden', 'true');

    const row = within(dialog).getByText('第一集').closest('.later-row');
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });

    expect(remove).toHaveAttribute('tabindex', '0');
    expect(remove).toHaveAttribute('aria-hidden', 'false');
  });

  it('warns when later playback cannot be persisted', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    try {
      render(<App initialCatalog={catalog} />);
      fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
      fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
      const dialog = screen.getByRole('dialog', { name: '播放列表' });
      fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));
      fireEvent.click(within(dialog).getByRole('button', { name: '添加节目' }));
      getEpisodes.mockResolvedValue({ episodes: [episode(4, '待添加节目')], hasMore: false });
      fireEvent.click(within(dialog).getByRole('button', { name: '选择专辑 NIO 精选' }));
      fireEvent.click(await within(dialog).findByRole('button', { name: '添加 待添加节目 到稍后播放' }));

      expect(within(dialog).getByRole('status')).toHaveTextContent('无法保存');
    } finally {
      setItem.mockRestore();
    }
  });

  it('keeps add-program unavailable while a restored player waits for the catalog', async () => {
    const restored = selectEpisode(createPlayerState(), episode(1, '第一集'));
    window.localStorage.setItem(PLAYER_STORAGE_KEY, serializePlayerState(restored));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(() => new Promise(() => {}));
    try {
      render(<App />);
      fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
      const dialog = screen.getByRole('dialog', { name: '播放列表' });
      fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));

      expect(within(dialog).getByRole('button', { name: '添加节目' })).toBeDisabled();
    } finally {
      globalThis.fetch = originalFetch;
    }
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

  it('adds an episode when its title or artwork is clicked in the picker', async () => {
    getEpisodes.mockResolvedValue({ episodes: [episode(6, '整行添加节目')], hasMore: false });
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('tab', { name: '稍后播放' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '添加节目' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '选择专辑 NIO 精选' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: '整行添加节目' }));

    expect(within(dialog).getByText('已添加到稍后播放')).toBeInTheDocument();
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

  it('adds an album episode from its compact action menu', async () => {
    getEpisodes.mockResolvedValue({ episodes: [episode(5, '专辑节目')], hasMore: false });
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
    const manage = await screen.findByRole('button', { name: '管理 专辑节目' });
    fireEvent.click(manage);
    expect(manage).toHaveAttribute('aria-expanded', 'true');
    expect(manage).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '稍后播放' }));

    expect(window.localStorage.getItem('nio_play_later_v1')).toContain('专辑节目');
  });

  it('clears the album action notice after a short confirmation window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getEpisodes.mockResolvedValue({ episodes: [episode(5, '专辑节目')], hasMore: false });
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
    fireEvent.click(await screen.findByRole('button', { name: '管理 专辑节目' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '稍后播放' }));

    expect(screen.getByRole('status')).toHaveTextContent('已添加到稍后播放');
    await vi.advanceTimersByTimeAsync(2400);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('moves later items with keyboard-friendly menu actions', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集'), episode(3, '第三集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    fireEvent.click(within(dialog).getByRole('button', { name: '管理 第二集' }));
    fireEvent.click(within(dialog).getByRole('menuitem', { name: '上移' }));

    const rows = [...dialog.querySelectorAll('.later-row')];
    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining('第二集'),
      expect.stringContaining('第一集'),
      expect.stringContaining('第三集'),
    ]);
  });

  it('marks an open later action menu on its row and exposes expanded state', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const trigger = within(dialog).getByRole('button', { name: '管理 第二集' });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger.closest('.later-row')).toHaveClass('is-menu-open');
  });

  it('reveals a remove action after a horizontal swipe', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const row = within(dialog).getByText('第一集').closest('.later-row');
    fireEvent.pointerDown(row, { pointerId: 1, clientX: 200, clientY: 100, pointerType: 'touch' });
    fireEvent.pointerMove(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });
    fireEvent.pointerUp(row, { pointerId: 1, clientX: 120, clientY: 103, pointerType: 'touch' });
    fireEvent.click(within(dialog).getByRole('button', { name: '移除 第一集' }));

    expect(within(dialog).queryByText('第一集')).not.toBeInTheDocument();
  });

  it('reorders later items after a long-press vertical drag', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const row = within(dialog).getByText('第二集').closest('.later-row');
    vi.useFakeTimers();
    fireEvent.pointerDown(row, { pointerId: 2, clientX: 180, clientY: 160, pointerType: 'touch' });
    vi.advanceTimersByTime(250);
    fireEvent.pointerMove(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });
    fireEvent.pointerUp(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });

    const rows = [...dialog.querySelectorAll('.later-row')];
    expect(rows[0]).toHaveTextContent('第二集');
  });

  it('captures and releases the pointer during a long-press drag', async () => {
    window.localStorage.setItem('nio_play_later_v1', JSON.stringify([episode(1, '第一集'), episode(2, '第二集')]));
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '稍后播放' }));
    const dialog = screen.getByRole('dialog', { name: '播放列表' });
    const row = within(dialog).getByText('第二集').closest('.later-row');
    row.setPointerCapture = vi.fn();
    row.releasePointerCapture = vi.fn();
    row.hasPointerCapture = vi.fn(() => true);

    vi.useFakeTimers();
    fireEvent.pointerDown(row, { pointerId: 2, clientX: 180, clientY: 160, pointerType: 'touch' });
    vi.advanceTimersByTime(250);
    fireEvent.pointerMove(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });
    fireEvent.pointerUp(row, { pointerId: 2, clientX: 181, clientY: 80, pointerType: 'touch' });

    expect(row.setPointerCapture).toHaveBeenCalledWith(2);
    expect(row.releasePointerCapture).toHaveBeenCalledWith(2);
    expect(row).not.toHaveClass('is-dragging');
  });

  it('advances to the next episode once when playback ends', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第一集');

    fireEvent.ended(document.querySelector('audio'));

    await waitFor(() => expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第二集'));
  });
});
