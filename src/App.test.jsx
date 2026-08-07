import { useCallback, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AlbumResults } from './components/AlbumResults';

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
    window.history.replaceState({ nioDepth: 0 }, '', '#/');
    window.localStorage.clear();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('shows the recommendation and starts all visible episodes', async () => {
    render(<App initialCatalog={catalog} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    expect(screen.getAllByText('第一集').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    expect(await screen.findByRole('button', { name: '打开播放列表' })).toBeInTheDocument();
    expect(screen.getAllByText('第一集').length).toBeGreaterThan(0);
  });

  it('shows a recoverable error when the selected episode has no audio URL', async () => {
    const catalogWithoutAudio = {
      ...catalog,
      albums: [{ ...catalog.albums[0], latestEpisode: { ...catalog.albums[0].latestEpisode, audioUrl: '' } }],
    };
    render(<App initialCatalog={catalogWithoutAudio} />);

    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('没有可播放音频');
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });

  it('loads large album lists in batches', async () => {
    const albums = Array.from({ length: 101 }, (_, index) => ({
      id: index + 1,
      name: `专辑 ${index + 1}`,
      description: '描述',
      imageUrl: '',
      latestEpisode: episode(index + 1, `节目 ${index + 1}`),
    }));
    const { container } = render(<AlbumResults albums={albums} onOpenAlbum={() => {}} />);

    expect(container.querySelectorAll('.album-results > li:not(.album-results-more)')).toHaveLength(100);
    expect(container.querySelector('.album-results-more')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '加载更多专辑' }));
    expect(container.querySelectorAll('.album-results > li:not(.album-results-more)')).toHaveLength(101);
    expect(container.querySelector('.album-results-more')).not.toBeInTheDocument();
  });

  it('keeps the recommendation panel mounted while the compact header changes', async () => {
    render(<App initialCatalog={catalog} />);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 220 });
    fireEvent.scroll(window);

    await waitFor(() => expect(document.querySelector('.top-title')).toHaveTextContent('今日推荐'));
    expect(document.querySelector('.recommendation-panel')).toBeInTheDocument();
    expect(document.querySelector('.updates-section')).toBeInTheDocument();
  });

  it('initializes the compact header from a restored scroll position', async () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 220 });
    render(<App initialCatalog={catalog} />);

    await waitFor(() => expect(document.querySelector('.top-title')).toHaveTextContent('今日推荐'));
    expect(document.querySelector('.recommendation-panel')).toBeInTheDocument();
  });

  it('opens the full album directory from the home back control', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));

    expect(window.location.hash).toBe('#/albums');
    expect(await screen.findByRole('heading', { name: '全部专辑' })).toBeInTheDocument();
    expect(screen.getByText('NIO 精选')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回主页' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '今日推荐' })).toBeInTheDocument());
  });

  it('shows the pinned briefing albums first in the full album directory', async () => {
    const pinnedCatalog = {
      ...catalog,
      albums: [
        { id: 7, name: '普通专辑', description: '', imageUrl: '', latestEpisode: { ...episode(71, '最新节目'), onlineTime: Date.now() + 100000 } },
        { id: 23, name: '资讯充电站·晚间版', description: '', imageUrl: '', latestEpisode: episode(231, '晚间节目', Date.now() - 100000) },
        { id: 5, name: '资讯充电站·早间版', description: '', imageUrl: '', latestEpisode: episode(51, '早间节目', Date.now() - 200000) },
      ],
    };
    render(<App initialCatalog={pinnedCatalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });

    const rows = screen.getAllByRole('button', { name: /^(资讯充电站·早间版|资讯充电站·晚间版|普通专辑)/ });
    expect(rows[0]).toHaveAccessibleName('资讯充电站·早间版早间节目');
    expect(rows[1]).toHaveAccessibleName('资讯充电站·晚间版晚间节目');
    expect(rows[2]).toHaveAccessibleName('普通专辑最新节目');
  });

  it('pins favorited albums first and keeps city channels last', async () => {
    const favoriteCatalog = {
      generatedAt: Date.now(),
      albums: [
        { id: 1, name: 'NIO 精选', description: '精选内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(1, '第一集'), onlineTime: 300 } },
        { id: 2, name: '另一张专辑', description: '更多内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(2, '第二集'), onlineTime: 200 } },
        { id: 9, name: '上海天气预报', description: '天气内容', imageUrl: '', episodeCount: 1, latestEpisode: { ...episode(9, '天气节目'), onlineTime: 100 } },
      ],
    };
    render(<App initialCatalog={favoriteCatalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });

    const directoryRows = () => screen.getAllByRole('button', { name: /^(NIO 精选|另一张专辑|上海天气预报)/ });
    expect(directoryRows().map(button => button.textContent)).toEqual(['NIO 精选第一集', '另一张专辑第二集', '上海天气预报天气节目']);

    fireEvent.click(screen.getByRole('button', { name: '管理 上海天气预报' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '收藏专辑' }));

    expect(directoryRows().map(button => button.textContent)).toEqual(['上海天气预报天气节目', 'NIO 精选第一集', '另一张专辑第二集']);
    expect(window.localStorage.getItem('nio_favorite_albums_v1')).toBe(JSON.stringify([9]));

    fireEvent.click(screen.getByRole('button', { name: '管理 上海天气预报' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '取消收藏' }));

    expect(directoryRows().map(button => button.textContent)).toEqual(['NIO 精选第一集', '另一张专辑第二集', '上海天气预报天气节目']);
  });

  it('restores favorited albums from local storage', async () => {
    window.localStorage.setItem('nio_favorite_albums_v1', JSON.stringify([2]));
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });

    const rows = screen.getAllByRole('button', { name: /^(NIO 精选|另一张专辑)/ });
    expect(rows[0]).toHaveAccessibleName('另一张专辑第二集');
    expect(rows[1]).toHaveAccessibleName('NIO 精选第一集');
  });

  it('marks Home to Albums navigation as forward and Back as back', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'forward');

    fireEvent.click(screen.getByRole('button', { name: '返回主页' }));
    await screen.findByRole('heading', { name: '今日推荐' });
    expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'back');
  });

  it('does not replay route motion for duplicate popstate and hashchange events', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(document.querySelector('.route-view')).toHaveAttribute('data-route-motion', 'forward');
  });

  it('resets the document scroll when opening the album directory', async () => {
    document.documentElement.scrollTop = 240;
    document.body.scrollTop = 240;
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: '全部专辑' })).toBeInTheDocument());
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it('returns to the album directory after searching from the directory', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    expect(await screen.findByRole('searchbox', { name: '搜索专辑' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部专辑' })).toBeInTheDocument());
  });

  it('returns to the album directory after opening an album from the directory', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
    expect(window.location.hash).toBe('#/album/1');

    fireEvent.click(await screen.findByRole('button', { name: '返回专辑列表' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: '全部专辑' })).toBeInTheDocument());
  });

  it('walks back through search and albums without getting stuck', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    fireEvent.change(await screen.findByRole('searchbox', { name: '搜索专辑' }), { target: { value: 'NIO' } });
    fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));

    fireEvent.click(await screen.findByRole('button', { name: '返回专辑列表' }));
    await waitFor(() => expect(window.location.hash).toBe('#/search?q=NIO'));
    expect(await screen.findByRole('searchbox', { name: '搜索专辑' })).toHaveValue('NIO');

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(window.location.hash).toBe('#/albums'));
  });

  it('keeps the search input mounted while the query changes', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    const input = await screen.findByRole('searchbox', { name: '搜索专辑' });
    fireEvent.change(input, { target: { value: 'NIO' } });

    await waitFor(() => expect(input).toHaveValue('NIO'));
    expect(screen.getByRole('searchbox', { name: '搜索专辑' })).toBe(input);
  });

  it('restores the directory scroll position after album detail', async () => {
    render(<App initialCatalog={catalog} />);

    fireEvent.click(screen.getByRole('button', { name: '全部专辑' }));
    await screen.findByRole('heading', { name: '全部专辑' });
    document.documentElement.scrollTop = 420;
    document.body.scrollTop = 420;
    fireEvent.click(screen.getByRole('button', { name: 'NIO 精选第一集' }));
    fireEvent.click(await screen.findByRole('button', { name: '返回专辑列表' }));

    await waitFor(() => expect(document.documentElement.scrollTop).toBe(420));
    expect(document.body.scrollTop).toBe(420);
  });

  it('does not rerender memoized album results when an unrelated parent updates', () => {
    let renders = 0;
    function Harness() {
      const [, setTick] = useState(0);
      const onRender = useCallback(() => { renders += 1; }, []);
      const onOpenAlbum = useCallback(() => {}, []);
      return <>
        <button type="button" onClick={() => setTick(value => value + 1)}>tick</button>
        <AlbumResults albums={catalog.albums} onOpenAlbum={onOpenAlbum} onRender={onRender} />
      </>;
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'tick' }));
    fireEvent.click(screen.getByRole('button', { name: 'tick' }));
    expect(renders).toBe(1);
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

  it('seeks the audio element when the progress slider changes', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 0 });
    fireEvent.loadedMetadata(audio);

    fireEvent.change(screen.getByRole('slider', { name: '播放进度' }), { target: { value: '30' } });

    expect(audio.currentTime).toBe(30);
  });

  it('restarts the current episode after it was paused and selected again', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    const play = vi.spyOn(audio, 'play');
    fireEvent.pause(audio);
    play.mockClear();

    fireEvent.click(document.querySelector('.episode-main'));

    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(screen.getAllByRole('button', { name: '暂停' }).length).toBeGreaterThan(0);
  });

  it('returns to the play state when starting audio is rejected', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    const play = vi.spyOn(audio, 'play');
    fireEvent.pause(audio);
    play.mockRejectedValueOnce(new Error('blocked'));

    fireEvent.click(screen.getByRole('button', { name: '播放' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });

  it('stops and removes the audio source when the last queue item is removed', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    const pause = vi.spyOn(audio, 'pause');
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));

    fireEvent.click(screen.getAllByRole('button', { name: /管理/ })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: '移出列表' }));
    fireEvent.click(screen.getByRole('button', { name: /管理/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: '移出列表' }));

    await waitFor(() => expect(screen.queryByRole('region', { name: '当前播放' })).not.toBeInTheDocument());
    expect(audio.getAttribute('src')).toBeNull();
    expect(pause).toHaveBeenCalled();
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

    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe('#/'));
  });

  it('keeps the queue mounted during its closing animation and restores focus', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const trigger = await screen.findByRole('button', { name: '打开播放列表' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '收起播放列表' }));

    fireEvent.click(screen.getByRole('button', { name: '关闭播放列表' }));
    expect(dialog).toHaveClass('is-closing');
    await waitFor(() => expect(window.location.hash).toBe('#/'));
    expect(screen.getByRole('dialog', { name: '播放列表' })).toBeInTheDocument();

    fireEvent.animationEnd(dialog, { animationName: 'queue-sheet-out' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('uses the same closing state for Escape', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    await fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog).toHaveClass('is-closing');
    fireEvent.animationEnd(dialog, { animationName: 'queue-sheet-out' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
  });

  it('closes an open queue action menu before closing the sheet on Escape', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    const manageButtons = screen.getAllByRole('button', { name: /管理/ });
    expect(manageButtons.length).toBeGreaterThan(0);
    fireEvent.click(manageButtons[0]);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(dialog).not.toHaveClass('is-closing');
  });

  it('lets browser Back close the sheet before changing the route', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    expect(window.location.hash).toBe('#/?queue=1');

    window.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '播放列表' })).not.toBeInTheDocument());
  });

  it('does not close the queue when dragging inside its scroll area', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    const scroll = dialog.querySelector('.queue-scroll');

    fireEvent.pointerDown(scroll, { clientY: 100 });
    fireEvent.pointerUp(scroll, { clientY: 220 });

    expect(window.location.hash).toBe('#/?queue=1');
    expect(dialog).not.toHaveClass('is-closing');
  });

  it('traps Tab focus inside the queue dialog', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const dialog = await screen.findByRole('dialog', { name: '播放列表' });
    const buttons = dialog.querySelectorAll('button');
    buttons[0].focus();

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('shares a queue episode from the row menu with a clipboard fallback', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboardWrite } });
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('button', { name: '管理 第一集' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '分享' }));
    expect(clipboardWrite).toHaveBeenCalledWith(expect.stringContaining('第一集'));
    expect(await screen.findByText('已复制分享链接')).toBeInTheDocument();
  });

  it('picks a playback speed from the mini player menu and persists it', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(screen.getByRole('button', { name: '播放速度 1×' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: '1.5×' })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole('menuitem', { name: '1.5×' }));
    expect(document.querySelector('audio').playbackRate).toBe(1.5);
    expect(window.localStorage.getItem('nio_playback_rate_v1')).toBe('1.5');
    expect(screen.getByRole('button', { name: '播放速度 1.5×' })).toBeInTheDocument();
  });

  it('closes the speed menu when tapping outside', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(screen.getByRole('button', { name: '播放速度 1×' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('supports arrow and boundary keys for queue tabs', async () => {
    render(<App initialCatalog={catalog} />);
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    const queueTab = screen.getByRole('tab', { name: '播放列表' });
    const historyTab = screen.getByRole('tab', { name: '最近听过' });
    const laterTab = screen.getByRole('tab', { name: '稍后播放' });

    queueTab.focus();
    fireEvent.keyDown(queueTab, { key: 'ArrowRight' });
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement).toBe(historyTab));

    fireEvent.keyDown(historyTab, { key: 'End' });
    expect(laterTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement).toBe(laterTab));

    fireEvent.keyDown(laterTab, { key: 'Home' });
    expect(queueTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement).toBe(queueTab));
  });

  it('continues the current episode from the top bar instead of restarting it', async () => {
    render(<App initialCatalog={catalog} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 45 });
    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);
    const play = vi.spyOn(audio, 'play');
    fireEvent.pause(audio);
    play.mockClear();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 });
    fireEvent.scroll(window);
    fireEvent.click(within(document.querySelector('.top-bar')).getByRole('button', { name: /继续播放/ }));

    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(audio.currentTime).toBe(45);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('does not restart an already-playing episode from the continue button', async () => {
    render(<App initialCatalog={catalog} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 30 });
    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 300 });
    fireEvent.scroll(window);
    fireEvent.click(within(document.querySelector('.top-bar')).getByRole('button', { name: /继续播放/ }));

    expect(audio.currentTime).toBe(30);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('skips an unplayable episode when advancing to the next one', async () => {
    const playable = episode(1, '第一集');
    const unplayable = { ...episode(2, '第二集'), audioUrl: '' };
    const third = episode(3, '第三集');
    localStorage.setItem('nio_player_state_v2', JSON.stringify({
      version: 2,
      queue: [playable, unplayable, third],
      queueIndex: 0,
      currentEpisode: playable,
      positionSeconds: 0,
      durationSeconds: 0,
      history: [],
      updatedAt: Date.now(),
    }));
    render(<App initialCatalog={catalog} />);
    const audio = document.querySelector('audio');
    await waitFor(() => expect(audio.getAttribute('src')).toBe(playable.audioUrl));
    fireEvent.play(audio);
    fireEvent.ended(audio);

    await waitFor(() => expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第三集'));
  });

  it('stops at the end of the queue when no playable next episode exists', async () => {
    const playable = episode(1, '第一集');
    const unplayable = { ...episode(2, '第二集'), audioUrl: '' };
    localStorage.setItem('nio_player_state_v2', JSON.stringify({
      version: 2,
      queue: [playable, unplayable],
      queueIndex: 0,
      currentEpisode: playable,
      positionSeconds: 0,
      durationSeconds: 0,
      history: [],
      updatedAt: Date.now(),
    }));
    render(<App initialCatalog={catalog} />);
    const audio = document.querySelector('audio');
    await waitFor(() => expect(audio.getAttribute('src')).toBe(playable.audioUrl));
    fireEvent.play(audio);
    fireEvent.ended(audio);

    expect(screen.getByRole('region', { name: '当前播放' })).toHaveTextContent('第一集');
    expect(screen.getByRole('button', { name: '播放' })).toBeInTheDocument();
  });

  it('re-applies the resume position once metadata becomes available', async () => {
    const playable = episode(1, '第一集');
    localStorage.setItem('nio_player_state_v2', JSON.stringify({
      version: 2,
      queue: [playable],
      queueIndex: 0,
      currentEpisode: playable,
      positionSeconds: 100,
      durationSeconds: 500,
      history: [],
      updatedAt: Date.now(),
    }));
    const originalCurrentTime = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
    let firstSeekFails = true;
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get() { return this._nioTestCurrentTime || 0; },
      set(value) {
        if (firstSeekFails && value > 0) {
          firstSeekFails = false;
          throw new Error('metadata not ready');
        }
        this._nioTestCurrentTime = value;
      },
    });
    try {
      render(<App initialCatalog={catalog} />);
      const audio = document.querySelector('audio');
      await waitFor(() => expect(audio.getAttribute('src')).toBe(playable.audioUrl));
      Object.defineProperty(audio, 'duration', { configurable: true, value: 500 });
      fireEvent.loadedMetadata(audio);

      expect(audio.currentTime).toBe(100);
    } finally {
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', originalCurrentTime);
    }
  });

  it('throttles playback progress updates to once per second', async () => {
    render(<App initialCatalog={catalog} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    const audio = document.querySelector('audio');
    Object.defineProperty(audio, 'duration', { configurable: true, value: 120 });
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 10 });
    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: '播放进度' })).toHaveValue('10');
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 20 });
    fireEvent.timeUpdate(audio);
    expect(screen.getByRole('slider', { name: '播放进度' })).toHaveValue('10');
  });

  it('does not record an unplayable episode in listening history', async () => {
    const catalogWithoutAudio = {
      ...catalog,
      albums: [{ ...catalog.albums[0], latestEpisode: { ...catalog.albums[0].latestEpisode, audioUrl: '' } }],
    };
    render(<App initialCatalog={catalogWithoutAudio} />);
    expect(await screen.findByText('今日推荐')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部播放' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('没有可播放音频');
    fireEvent.click(await screen.findByRole('button', { name: '打开播放列表' }));
    fireEvent.click(screen.getByRole('tab', { name: '最近听过' }));
    expect(screen.getByText('还没有听过的节目')).toBeInTheDocument();
  });
});
