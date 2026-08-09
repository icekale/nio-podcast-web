import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, SCENE_CATEGORIES, categorizeAlbum, categorizeAlbumName, categoryLabel } from './album-categories.js';

describe('album categories', () => {
  it('defines the six vehicle scenes with scene|sub labels', () => {
    expect(SCENE_CATEGORIES.map(c => c.id)).toEqual(['commute', 'kids', 'relax', 'longhaul', 'city', 'car']);
    expect(CATEGORY_LABELS.get('commute')).toBe('通勤场景|资讯速递');
    expect(CATEGORY_LABELS.get('kids')).toBe('宝贝同行|哄娃陪伴');
    expect(CATEGORY_LABELS.get('car')).toBe('玩转爱车|提车必听');
  });

  it('prefers the manual id mapping over name rules', () => {
    expect(categorizeAlbum({ id: 35, name: '芝士分子' })).toBe('kids');
    expect(categorizeAlbum({ id: 584, name: 'N问' })).toBe('longhaul');
    expect(categorizeAlbum({ id: 5, name: '资讯充电站·早间版' })).toBe('commute');
    expect(categorizeAlbum({ id: 107, name: '城市频道精选集' })).toBe('city');
  });

  it('falls back to name rules for unmapped albums', () => {
    expect(categorizeAlbum({ id: 999, name: '上海天气预报' })).toBe('city');
    expect(categorizeAlbum({ id: 999, name: '金龟子讲绘本故事' })).toBe('kids');
    expect(categorizeAlbum({ id: 999, name: '经典音乐精选' })).toBe('relax');
    expect(categorizeAlbum({ id: 999, name: '用车小百科' })).toBe('car');
    expect(categorizeAlbum({ id: 999, name: '早间新闻速递' })).toBe('commute');
  });

  it('returns null for albums matching no category', () => {
    expect(categorizeAlbum({ id: 999, name: '路人抓马' })).toBeNull();
    expect(categorizeAlbumName('')).toBeNull();
    expect(categorizeAlbum(null)).toBeNull();
  });

  it('maps only known category ids to labels', () => {
    expect(categoryLabel('relax')).toBe('舒缓驾驶|乐伴旅途');
    expect(categoryLabel('unknown')).toBeNull();
  });
});
