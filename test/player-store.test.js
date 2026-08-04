import { beforeEach, describe, expect, it, vi } from 'vitest';

function fakeBgm() {
  const handlers = {};
  const on = event => fn => { handlers[event] = fn; };
  return {
    src: '', title: '', epname: '', singer: '', coverImgUrl: '', startTime: 0, currentTime: 0,
    onTimeUpdate: on('timeupdate'),
    onEnded: on('ended'),
    onError: on('error'),
    onPlay: on('play'),
    onPause: on('pause'),
    fire(event, ...args) { handlers[event]?.(...args); },
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(),
  };
}

function persistedState(episodes, { isPlaying = true, index = 0 } = {}) {
  return JSON.stringify({
    version: 2,
    currentEpisode: episodes[index],
    queue: episodes,
    queueIndex: index,
    positionSeconds: 0,
    durationSeconds: episodes[index] ? (episodes[index].duration || 0) / 1000 : 0,
    isPlaying,
    history: [],
    updatedAt: Date.now(),
  });
}

async function boot(episodes, { isPlaying = true } = {}) {
  const bgm = fakeBgm();
  const storage = {
    getItem: key => (key === 'nio_player_state_v2' ? persistedState(episodes, { isPlaying }) : null),
    setItem: () => true,
  };
  vi.resetModules();
  const store = await import('../services/player-store');
  store.initPlayerStore({ storage, bgm });
  return { bgm, store };
}

const episode = id => ({
  id,
  title: `节目 ${id}`,
  albumId: 5,
  albumName: '测试专辑',
  albumPic: '',
  host: 'NIO Radio',
  duration: 253000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

describe('player store', () => {
  beforeEach(() => { vi.resetModules(); });

  it('restores the persisted episode without autoplaying', async () => {
    const { bgm, store } = await boot([episode(1)], { isPlaying: true });
    expect(bgm.play).not.toHaveBeenCalled();
    expect(bgm.src).toBe('https://cdn.example/1.aac');
    expect(store.getState().player.currentEpisode.id).toBe(1);
  });

  it('advances once on ended, removes the completed episode from later, and stops at the tail', async () => {
    const { bgm, store } = await boot([episode(1), episode(2)]);
    store.addLater(episode(1));

    bgm.fire('ended');
    expect(store.getState().player.currentEpisode.id).toBe(2);
    expect(store.getState().player.isPlaying).toBe(true);
    expect(store.getState().later).toEqual([]);

    bgm.fire('ended');
    expect(store.getState().player.currentEpisode.id).toBe(2);
    expect(store.getState().player.isPlaying).toBe(false);
  });
});
