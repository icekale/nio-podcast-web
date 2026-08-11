import { describe, expect, it } from 'vitest';
import {
  CUSTOM_WHITE_NOISE_ALBUM,
  CUSTOM_WHITE_NOISE_ALBUM_ID,
  getCustomEpisodes,
  isLoopingEpisode,
} from './customAlbums';

describe('custom white-noise album', () => {
  it('contains 30 ordered, looping, commit-pinned tracks', () => {
    const result = getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 1, 30);

    expect(result.episodes).toHaveLength(30);
    expect(result.episodes.slice(0, 3).map(item => item.title)).toEqual(['小雨', '大雨', '车顶雨声']);
    expect(result.episodes.every(isLoopingEpisode)).toBe(true);
    expect(result.episodes.every(item => item.audioUrl.includes('/3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629/'))).toBe(true);
    expect(new Set(result.episodes.map(item => item.id)).size).toBe(30);
  });

  it('uses the approved album copy and paginates locally', () => {
    expect(CUSTOM_WHITE_NOISE_ALBUM).toMatchObject({
      name: '白噪音',
      category: 'commute',
      description: '让雨声与风声，陪你安静抵达。',
      episodeCount: 30,
    });
    expect(getCustomEpisodes(CUSTOM_WHITE_NOISE_ALBUM_ID, 2, 20)).toMatchObject({
      totalCount: 30,
      hasMore: false,
    });
    expect(getCustomEpisodes(5, 1, 30)).toBeNull();
  });
});
