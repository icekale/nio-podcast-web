import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Pause, Play } from 'lucide';
import { canonicalD } from 'morphicons/dom';
import { HomeScreen } from './HomeScreen';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const episode = {
  id: 1,
  title: '第一集',
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: '',
  duration: 60000,
  onlineTime: Date.now(),
  audioUrl: 'https://cdn.example/1.aac',
};

const catalog = {
  generatedAt: Date.now(),
  albums: [{
    id: 1,
    name: 'NIO 精选',
    description: '精选内容',
    imageUrl: '',
    episodeCount: 1,
    latestEpisode: episode,
  }],
};

const player = isPlaying => ({
  currentEpisode: episode,
  isPlaying,
  queue: [episode],
  queueIndex: 0,
  positionSeconds: 0,
  durationSeconds: 60,
});

const callbacks = {
  onRetry: () => {},
  onPlay: () => {},
  onPlayAll: () => {},
  onResume: () => {},
  onTogglePlayback: () => {},
  onSearch: () => {},
  onOpenAlbums: () => {},
};

describe('HomeScreen playback control', () => {
  it('keeps the brand title and syncs theme color across scroll and unmount', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const { container, unmount } = render(<HomeScreen {...callbacks} catalog={catalog} player={player(false)} />);
    const panel = container.querySelector('.recommendation-panel');
    const header = container.querySelector('.top-bar');
    panel.getBoundingClientRect = () => ({ bottom: 400 });
    header.getBoundingClientRect = () => ({ bottom: 56 });
    expect(meta.content).toBe('#e7f7f7');
    vi.stubGlobal('scrollY', 200);
    fireEvent.scroll(window);
    expect(meta.content).toBe('#e7f7f7');
    panel.getBoundingClientRect = () => ({ bottom: 55 });
    fireEvent.scroll(window);
    expect(meta.content).toBe('#ffffff');
    expect(header.querySelector('.top-title')).toHaveTextContent('NIO Radio');
    vi.stubGlobal('scrollY', 0);
    fireEvent.scroll(window);
    expect(meta.content).toBe('#e7f7f7');
    unmount();
    expect(meta.content).toBe('#ffffff');
    expect(document.documentElement.dataset.homeTop).toBeUndefined();
    meta.remove();
  });
  it('keeps the current icon as the first frame of a play-pause morph', () => {
    const { container, rerender } = render(<HomeScreen {...callbacks} catalog={catalog} player={player(false)} />);
    const iconPath = () => container.querySelector('.primary-button path')?.getAttribute('d');
    const playPath = iconPath();

    rerender(<HomeScreen {...callbacks} catalog={catalog} player={player(true)} />);

    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
    expect(playPath).toBe(canonicalD(Play));
    expect(iconPath()).toBe(playPath);
  });

  it('settles on the pause icon after a play-pause morph', async () => {
    const { container, rerender } = render(<HomeScreen {...callbacks} catalog={catalog} player={player(false)} />);
    const iconPath = () => container.querySelector('.primary-button path')?.getAttribute('d');

    rerender(<HomeScreen {...callbacks} catalog={catalog} player={player(true)} />);

    await waitFor(() => expect(iconPath()).toBe(canonicalD(Pause)));
  });

  it('puts catalog daily updates after daytime entries without duplicates', () => {
    const catalogWithUpdates = {
      generatedAt: Date.now(),
      albums: [
        { id: 1, name: '专辑一', latestEpisode: { ...episode, id: 1, title: '每日一' } },
        { id: 2, name: '专辑二', latestEpisode: { ...episode, id: 2, title: '日间二旧' } },
        { id: 3, name: '专辑三', latestEpisode: { ...episode, id: 3, title: '每日三' } },
      ],
    };
    const daytimeEpisodes = [
      { ...episode, id: 2, title: '日间二' },
      { ...episode, id: 4, title: '日间四' },
    ];
    const { container } = render(<HomeScreen {...callbacks} catalog={catalogWithUpdates} daytimeEpisodes={daytimeEpisodes} player={player(false)} />);

    expect([...container.querySelectorAll('.episode-row')].map(row => row.dataset.episodeId)).toEqual(['2', '4', '1', '3']);
    expect(screen.getByRole('heading', { name: '日间' })).toBeInTheDocument();
  });

  it('does not append latest catalog updates when there are no updates today', () => {
    const staleCatalog = {
      generatedAt: Date.now(),
      albums: [{ id: 1, name: '旧专辑', latestEpisode: { ...episode, id: 1, title: '旧目录节目', onlineTime: 0 } }],
    };
    const daytimeEpisodes = [{ ...episode, id: 2, title: '日间节目' }];
    const { container } = render(<HomeScreen {...callbacks} catalog={staleCatalog} daytimeEpisodes={daytimeEpisodes} player={player(false)} />);

    expect([...container.querySelectorAll('.episode-row')].map(row => row.dataset.episodeId)).toEqual(['2']);
  });

  it('windows long home lists and loads more on demand', () => {
    const daytimeEpisodes = Array.from({ length: 25 }, (_, index) => ({ ...episode, id: index + 1, title: `节目${index + 1}` }));
    const { container } = render(<HomeScreen {...callbacks} catalog={{ generatedAt: Date.now(), albums: [] }} daytimeEpisodes={daytimeEpisodes} player={player(false)} />);
    expect(container.querySelectorAll('.episode-row')).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: '加载更多' }));
    expect(container.querySelectorAll('.episode-row')).toHaveLength(25);
  });

  it('loads more when the list end becomes visible', () => {
    let trigger;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { trigger = callback; }
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    const daytimeEpisodes = Array.from({ length: 25 }, (_, index) => ({ ...episode, id: index + 1, title: `节目${index + 1}` }));
    const { container } = render(<HomeScreen {...callbacks} catalog={{ generatedAt: Date.now(), albums: [] }} daytimeEpisodes={daytimeEpisodes} player={player(false)} />);
    expect(container.querySelectorAll('.episode-row')).toHaveLength(20);
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
    act(() => trigger([{ isIntersecting: true }]));
    expect(container.querySelectorAll('.episode-row')).toHaveLength(25);
  });

  it('switches immediately when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, rerender } = render(<HomeScreen {...callbacks} catalog={catalog} player={player(false)} />);

    rerender(<HomeScreen {...callbacks} catalog={catalog} player={player(true)} />);

    expect(container.querySelector('.primary-button path')?.getAttribute('d')).toBe(canonicalD(Pause));
  });

});
