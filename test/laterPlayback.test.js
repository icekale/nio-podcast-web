import { describe, expect, it } from 'vitest';
import {
  addLaterEpisode,
  moveLaterEpisode,
  readLaterEpisodes,
  removeLaterEpisode,
  writeLaterEpisodes,
} from '../utils/laterPlayback';

const episode = (id, title = `节目 ${id}`) => ({
  id,
  title,
  albumId: 1,
  albumName: 'NIO 精选',
  albumPic: 'https://cdn.example/cover.jpg',
  duration: 60000,
  audioUrl: `https://cdn.example/${id}.aac`,
});

describe('later playback state', () => {
  it('appends episodes and rejects duplicates by id', () => {
    const first = addLaterEpisode([], episode(1));
    const duplicate = addLaterEpisode(first.items, episode(1, '更新后的标题'));
    const second = addLaterEpisode(duplicate.items, episode(2));

    expect(first).toEqual({ added: true, items: [episode(1)] });
    expect(duplicate).toEqual({ added: false, items: [episode(1)] });
    expect(second.items.map(item => item.id)).toEqual([1, 2]);
  });

  it('removes an item and moves an item without changing other order', () => {
    const items = [episode(1), episode(2), episode(3)];
    expect(removeLaterEpisode(items, 2).map(item => item.id)).toEqual([1, 3]);
    expect(moveLaterEpisode(items, 2, 0).map(item => item.id)).toEqual([3, 1, 2]);
    expect(moveLaterEpisode(items, -1, 2)).toEqual(items);
  });

  it('persists valid data and treats malformed storage as empty', () => {
    const storage = { value: '', getItem: () => storage.value, setItem: (_key, value) => { storage.value = value; } };
    writeLaterEpisodes([episode(2), episode(1)], storage);
    expect(readLaterEpisodes(storage).map(item => item.id)).toEqual([2, 1]);
    storage.value = '{bad json';
    expect(readLaterEpisodes(storage)).toEqual([]);
  });
});
