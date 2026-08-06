import { describe, expect, it } from 'vitest';
import {
  advanceQueue,
  canResume,
  createPlayerState,
  enqueueEpisodes,
  insertNext,
  recordHistory,
  removeFromQueue,
  restorePlayerState,
  selectEpisode,
  serializePlayerState,
} from './playerState';

const episode = id => ({
  id,
  title: `节目 ${id}`,
  albumId: 5,
  albumName: '测试专辑',
  duration: 60000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

describe('player state', () => {
  it('creates a queue and starts at the first episode', () => {
    const state = enqueueEpisodes(createPlayerState(), [episode(1), episode(2)]);
    expect(state.queue.map(item => item.id)).toEqual([1, 2]);
    expect(state.queueIndex).toBe(0);
    expect(state.currentEpisode.id).toBe(1);
  });

  it('inserts an episode next and removes only the requested queue row', () => {
    const state = enqueueEpisodes(createPlayerState(), [episode(1), episode(2)]);
    const withNext = insertNext(state, episode(3));
    expect(withNext.queue.map(item => item.id)).toEqual([1, 3, 2]);
    expect(removeFromQueue(withNext, 3).queue.map(item => item.id)).toEqual([1, 2]);
  });

  it('keeps the current episode aligned when moving an existing item next', () => {
    const state = selectEpisode(enqueueEpisodes(createPlayerState(), [episode(1), episode(2), episode(3), episode(4)]), episode(3));

    const movedBeforeCurrent = insertNext(state, episode(1));
    expect(movedBeforeCurrent.queue.map(item => item.id)).toEqual([2, 3, 1, 4]);
    expect(movedBeforeCurrent.queueIndex).toBe(1);
    expect(movedBeforeCurrent.currentEpisode.id).toBe(3);

    const movedAfterCurrent = insertNext(state, episode(4));
    expect(movedAfterCurrent.queue.map(item => item.id)).toEqual([1, 2, 3, 4]);
    expect(movedAfterCurrent.queueIndex).toBe(2);
    expect(movedAfterCurrent.currentEpisode.id).toBe(3);

    expect(insertNext(state, episode(3))).toEqual(state);
  });

  it('advances to the next item without changing the queue order', () => {
    const state = enqueueEpisodes(createPlayerState(), [episode(1), episode(2)]);
    const next = advanceQueue(state);
    expect(next.currentEpisode.id).toBe(2);
    expect(next.queueIndex).toBe(1);
    expect(next.queue.map(item => item.id)).toEqual([1, 2]);
  });

  it('adds a directly selected episode to the queue when it is not there yet', () => {
    const state = enqueueEpisodes(createPlayerState(), [episode(1)]);
    const next = selectEpisode(state, episode(3));
    expect(next.queue.map(item => item.id)).toEqual([1, 3]);
    expect(next.currentEpisode.id).toBe(3);
    expect(next.queueIndex).toBe(1);
  });

  it('deduplicates history and keeps the newest 100 items', () => {
    const history = Array.from({ length: 100 }, (_, index) => episode(index));
    const next = recordHistory(history, episode(20));
    expect(next).toHaveLength(100);
    expect(next[0].id).toBe(20);
    expect(recordHistory(next, episode(101))[0].id).toBe(101);
    expect(recordHistory(next, episode(101)).length).toBe(100);
  });

  it('only resumes after ten seconds when at least thirty seconds remain', () => {
    expect(canResume(11, 60)).toBe(true);
    expect(canResume(10, 60)).toBe(false);
    expect(canResume(11, 35)).toBe(false);
  });

  it('restores valid state and safely discards invalid persisted JSON', () => {
    const state = enqueueEpisodes(createPlayerState(), [episode(1)]);
    const restored = restorePlayerState(serializePlayerState(state));
    expect(restored.currentEpisode.id).toBe(1);
    expect(restorePlayerState('{not-json').queue).toEqual([]);
    expect(restorePlayerState(JSON.stringify({ version: 1 })).queue).toEqual([]);
  });

  it('aligns a persisted current episode that is missing from the queue', () => {
    const raw = {
      version: 2,
      currentEpisode: episode(9),
      queue: [episode(1), episode(2)],
      queueIndex: 1,
      history: [],
      positionSeconds: 5,
      durationSeconds: 60,
      updatedAt: 0,
    };
    const restored = restorePlayerState(JSON.stringify(raw));
    expect(restored.currentEpisode.id).toBe(2);
    expect(restored.queueIndex).toBe(1);
  });

  it('serializes episodes without large description and file size fields', () => {
    const state = selectEpisode(createPlayerState(), {
      ...episode(1),
      albumDesc: 'x'.repeat(200),
      fileSize: 999999,
      host: '主持人',
      onlineTime: 123,
    });
    const parsed = JSON.parse(serializePlayerState(state));
    expect(parsed.currentEpisode).toMatchObject({ id: 1, title: '节目 1', audioUrl: 'https://cdn.example/1.aac' });
    expect(parsed.currentEpisode.albumDesc).toBeUndefined();
    expect(parsed.currentEpisode.fileSize).toBeUndefined();
    expect(parsed.queue[0].albumDesc).toBeUndefined();
    expect(parsed.queue[0].fileSize).toBeUndefined();
    const restored = restorePlayerState(JSON.stringify(parsed));
    expect(restored.currentEpisode.audioUrl).toBe('https://cdn.example/1.aac');
  });
});
