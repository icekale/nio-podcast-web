import { beforeEach, describe, expect, it, vi } from 'vitest';

function fakeBgm() {
  const handlers = {};
  const on = event => fn => { handlers[event] = fn; };
  return {
    src: '', title: '', epname: '', singer: '', coverImgUrl: '', startTime: 0, currentTime: 0, duration: 0,
    onTimeUpdate: on('timeupdate'),
    onEnded: on('ended'),
    onError: on('error'),
    onPlay: on('play'),
    onPause: on('pause'),
    onCanplay: on('canplay'),
    onStop: on('stop'),
    fire(event, ...args) { handlers[event]?.(...args); },
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(),
  };
}

function persistedState(episodes, { isPlaying = true, index = 0, position = 0 } = {}) {
  return JSON.stringify({
    version: 2,
    currentEpisode: episodes[index],
    queue: episodes,
    queueIndex: index,
    positionSeconds: position,
    durationSeconds: episodes[index] ? (episodes[index].duration || 0) / 1000 : 0,
    isPlaying,
    history: [],
    updatedAt: Date.now(),
  });
}

async function boot(episodes, { isPlaying = true, position = 0 } = {}) {
  const bgm = fakeBgm();
  const storage = {
    getItem: key => (key === 'nio_player_state_v2' ? persistedState(episodes, { isPlaying, position }) : null),
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

  it('resumes from the persisted position when the real duration is known', async () => {
    // 上个会话播放到 2:00（真实时长已持久化），重启后应恢复而不是从 0 开始。
    const { bgm } = await boot([episode(1)], { isPlaying: true, position: 120 });
    expect(bgm.startTime).toBe(120);
  });

  it('captures the real duration from the background audio manager', async () => {
    // 持久化里没有时长（旧数据），canplay 后应捕获真实时长。
    const { bgm, store } = await boot([{ ...episode(1), duration: 0 }]);
    expect(store.getState().player.durationSeconds).toBe(0);
    bgm.duration = 253;
    bgm.fire('canplay');
    expect(store.getState().player.durationSeconds).toBe(253);
  });

  it('reloads the audio when the currently playing episode is removed from the queue', async () => {
    const { bgm, store } = await boot([episode(1), episode(2)]);
    store.playEpisode(episode(1), [episode(1), episode(2)]);
    expect(store.getState().player.isPlaying).toBe(true);
    bgm.play.mockClear();
    store.removeQueue(1);
    expect(store.getState().player.currentEpisode.id).toBe(2);
    expect(bgm.src).toBe('https://cdn.example/2.aac');
    expect(bgm.play).toHaveBeenCalledTimes(1);
  });

  it('skips episodes without audio when advancing and plays the next playable one', async () => {
    const { bgm, store } = await boot([episode(1), { ...episode(2), audioUrl: '' }, episode(3)]);
    bgm.fire('ended');
    expect(store.getState().player.currentEpisode.id).toBe(3);
    expect(bgm.src).toBe('https://cdn.example/3.aac');
  });

  it('throttles position notifications to once per second', async () => {
    vi.useFakeTimers();
    try {
      const { bgm, store } = await boot([episode(1)]);
      let notified = 0;
      store.subscribe(() => { notified += 1; });
      notified = 0; // subscribe 立即回调一次，不计入
      bgm.currentTime = 5;
      bgm.fire('timeupdate');
      bgm.currentTime = 6;
      bgm.fire('timeupdate');
      expect(notified).toBe(1);
      vi.advanceTimersByTime(1000);
      bgm.currentTime = 7;
      bgm.fire('timeupdate');
      expect(notified).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
