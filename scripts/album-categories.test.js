import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  TOPIC_CATEGORIES,
  categorizeAlbum,
  categorizeAlbumName,
  reportCategoryCoverage,
} from './album-categories.js';

describe('album categories', () => {
  it('defines seven topic categories in display order', () => {
    expect(TOPIC_CATEGORIES).toEqual([
      { id: 'news', label: '资讯热点' },
      { id: 'car', label: '汽车蔚来' },
      { id: 'business', label: '商业科技' },
      { id: 'culture', label: '文化知识' },
      { id: 'lifestyle', label: '生活兴趣' },
      { id: 'audio', label: '音乐声音' },
      { id: 'kids', label: '亲子成长' },
    ]);
  });

  it('classifies typical albums into each topic', () => {
    expect(categorizeAlbum({ id: 64, name: '广州城市资讯' })).toBe('news');
    expect(categorizeAlbum({ id: 268, name: '用车百宝箱' })).toBe('car');
    expect(categorizeAlbum({ id: 541, name: '商业就是这样' })).toBe('business');
    expect(categorizeAlbum({ id: 608, name: '星星书房' })).toBe('culture');
    expect(categorizeAlbum({ id: 381, name: '晨曦说养生' })).toBe('lifestyle');
    expect(categorizeAlbum({ id: 306, name: '华语乐动听' })).toBe('audio');
    expect(categorizeAlbum({ id: 422, name: '金龟子讲绘本故事' })).toBe('kids');
  });

  it('prefers the manual id mapping over automatic rules', () => {
    expect(categorizeAlbum({ id: 35, name: '芝士分子' })).toBe('kids');
    expect(categorizeAlbum({ id: 584, name: 'N问' })).toBe('culture');
    expect(categorizeAlbum({ id: 5, name: '资讯充电站·早间版' })).toBe('news');
    expect(categorizeAlbum({ id: 401, name: '故事FM' })).toBe('lifestyle');
    expect(categorizeAlbum({ id: 107, name: '城市频道精选集' })).toBe('news');
    expect(categorizeAlbum({ id: 689, name: '青听' })).toBe('lifestyle');
  });

  it('uses description and latest title when the album name is ambiguous', () => {
    expect(categorizeAlbum({
      id: 688,
      name: '十字路口',
      description: '',
      latestEpisode: { title: '22 岁的具身 CEO 与人工智能' },
    })).toBe('business');
  });

  it('resolves overlapping keywords with the spec priority', () => {
    expect(categorizeAlbumName('蔚来儿童音乐电台')).toBe('car');
    expect(categorizeAlbumName('儿童音乐电台')).toBe('kids');
    expect(categorizeAlbumName('科技早报')).toBe('news');
  });

  it('does not classify from vague words alone', () => {
    expect(categorizeAlbumName('故事FM')).toBeNull();
    expect(categorizeAlbumName('成长日记')).toBeNull();
    expect(categorizeAlbumName('声音漂流瓶')).toBeNull();
    expect(categorizeAlbum({ id: 999, name: '路人抓马' })).toBeNull();
    expect(categorizeAlbum(null)).toBeNull();
  });

  it('covers at least 90% of the committed catalog', () => {
    const { albums } = JSON.parse(readFileSync(resolve('public/data/albums.json'), 'utf8'));
    const unknown = albums.filter(album => !categorizeAlbum(album)).length;
    expect(unknown / albums.length).toBeLessThan(0.1);
  });

  it('reports coverage and warns above 12% without throwing', () => {
    const log = { log: vi.fn(), warn: vi.fn() };
    const sparse = [
      { id: 1, name: '资讯充电站·早间版', category: 'news' },
      { id: 2, name: '路人抓马', category: null },
      { id: 3, name: '无人知晓', category: null },
    ];
    const report = reportCategoryCoverage(sparse, log);
    expect(report).toMatchObject({ unknown: 2, total: 3, ratio: 2 / 3 });
    expect(log.warn).toHaveBeenCalledOnce();
    expect(() => reportCategoryCoverage(sparse, log)).not.toThrow();
  });
});
