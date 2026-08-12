import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CUSTOM_WHITE_NOISE_ALBUM,
  CUSTOM_WHITE_NOISE_ALBUM_ID,
  CUSTOM_WHITE_NOISE_EPISODES,
  getCustomEpisodes,
  isLoopingEpisode,
} from './customAlbums';

describe('custom white-noise album', () => {
  it('contains all 113 ordered, looping, locally vendored OGG tracks', () => {
    const pages = [1, 2, 3, 4].map(page => getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, page, 30));
    const episodes = pages.flatMap(result => result.episodes);

    expect(pages.map(result => result.episodes.length)).toEqual([30, 30, 30, 23]);
    expect(pages.map(result => result.hasMore)).toEqual([true, true, true, false]);
    expect(episodes).toHaveLength(113);
    expect(episodes.slice(0, 3).map(item => item.title)).toEqual(['小雨', '大雨', '车顶雨声']);
    expect(episodes.every(isLoopingEpisode)).toBe(true);
    expect(episodes.every(item => item.audioUrl.startsWith('audio/'))).toBe(true);
    expect(episodes.every(item => item.audioUrl.endsWith('.ogg'))).toBe(true);
    expect(new Set(episodes.map(item => item.id)).size).toBe(113);
    expect(new Set(episodes.map(item => item.audioUrl)).size).toBe(113);
  });

  it('uses the approved album copy and reports complete pagination totals', () => {
    expect(CUSTOM_WHITE_NOISE_ALBUM).toMatchObject({
      name: '白噪音',
      category: 'commute',
      description: '让雨声与风声，陪你安静抵达。',
      episodeCount: 113,
    });
    expect(getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 2, 20)).toMatchObject({
      totalCount: 113,
      hasMore: true,
    });
    expect(getCustomEpisodes(5, 1, 30)).toBeNull();
  });

  it('has every white-noise audio file vendored under public/audio', () => {
    const missing = CUSTOM_WHITE_NOISE_EPISODES
      .map(item => join(process.cwd(), 'public', item.audioUrl))
      .filter(path => !existsSync(path));
    expect(missing).toEqual([]);
  });
});
