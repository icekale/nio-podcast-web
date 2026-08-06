import { describe, expect, it } from 'vitest';
import {
  addLaterEpisode,
  moveLaterEpisode,
  readLaterEpisodes,
  removeLaterEpisode,
  writeLaterEpisodes,
} from './laterPlayback';

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

  it('trims heavy fields from persisted episodes', () => {
    const storage = { value: '', getItem: () => storage.value, setItem: (_key, value) => { storage.value = value; } };
    const rich = { ...episode(1), albumDesc: 'x'.repeat(200), fileSize: 999999 };
    writeLaterEpisodes([rich], storage);
    const read = readLaterEpisodes(storage);
    expect(read[0].albumDesc).toBeUndefined();
    expect(read[0].fileSize).toBeUndefined();
    expect(read[0].audioUrl).toBe('https://cdn.example/1.aac');
    expect(read[0].title).toBe('节目 1');
  });

  it('caps the persisted list at 200 entries', () => {
    const storage = { value: '', getItem: () => storage.value, setItem: (_key, value) => { storage.value = value; } };
    const many = Array.from({ length: 250 }, (_, index) => episode(index + 1));
    writeLaterEpisodes(many, storage);
    expect(readLaterEpisodes(storage).length).toBe(200);
  });

  it('trims heavy fields from already-persisted legacy data on read', () => {
    const storage = {
      value: JSON.stringify([{ ...episode(7), albumDesc: 'legacy desc', fileSize: 777 }]),
      getItem: () => storage.value,
      setItem: (_key, value) => { storage.value = value; },
    };
    const read = readLaterEpisodes(storage);
    expect(read[0].albumDesc).toBeUndefined();
    expect(read[0].fileSize).toBeUndefined();
    expect(read[0].id).toBe(7);
  });
});
