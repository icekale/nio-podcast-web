export const CUSTOM_WHITE_NOISE_ALBUM_ID = 900001;

const CUSTOM_EPISODE_BASE_ID = 900001000;
const XMSLEEP_REVISION = '3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629';
const XMSLEEP_RAW = `https://raw.githubusercontent.com/Tosencen/XMSLEEP/${XMSLEEP_REVISION}/audio`;
const LIGHT_COVER = 'covers/white-noise-light.png';
const DARK_COVER = 'covers/white-noise-dark.png';

const sounds = [
  ['小雨', 149865, 'rain/light-rain.ogg'],
  ['大雨', 14863, 'rain/heavy_rain.ogg'],
  ['车顶雨声', 10015, 'rain/rain-on-car-roof.ogg'],
  ['伞上雨声', 26554, 'rain/rain-on-umbrella.ogg'],
  ['帐篷雨声', 150649, 'rain/rain-on-tent.ogg'],
  ['叶上雨声', 42219, 'rain/rain-on-leaves.ogg'],
  ['雨打窗台', 40240, 'rain/rain-on-windowsill.ogg'],
  ['雷雨声', 154737, 'rain/thunderstorm.ogg'],
  ['开车时遇雨', 50782, 'rain/rain-while-driving.ogg'],
  ['空荡街道的雨', 47320, 'rain/rain-on-empty-street.ogg'],
  ['绵绵细雨', 148320, 'rain/drizzle.ogg'],
  ['大雨落玻璃', 39280, 'rain/heavy-rain-on-glass.ogg'],
  ['河流', 105520, 'nature/river.ogg'],
  ['海浪', 95360, 'nature/waves.ogg'],
  ['篝火', 113560, 'nature/campfire.ogg'],
  ['风声', 72640, 'nature/wind.ogg'],
  ['树间风声', 57200, 'nature/wind-in-trees.ogg'],
  ['瀑布', 22160, 'nature/waterfall.ogg'],
  ['水滴', 47960, 'nature/droplets.ogg'],
  ['咖啡厅', 199094, 'places/cafe.ogg'],
  ['地铁站', 171030, 'places/subway-station.ogg'],
  ['办公室', 139727, 'places/office.ogg'],
  ['图书馆', 176528, 'places/library.ogg'],
  ['火车', 61063, 'transport/train.ogg'],
  ['火车内', 66503, 'transport/inside-a-train.ogg'],
  ['飞机', 60031, 'transport/airplane.ogg'],
  ['白噪音', 9502, 'noise/white-noise.ogg'],
  ['粉红噪音', 9506, 'noise/pink-noise.ogg'],
  ['棕噪音', 9510, 'noise/brown-noise.ogg'],
  ['风扇', 15137, 'things/风扇.ogg'],
];

export const CUSTOM_WHITE_NOISE_EPISODES = sounds.map(([title, duration, path], index) => ({
  id: CUSTOM_EPISODE_BASE_ID + index + 1,
  title,
  albumId: CUSTOM_WHITE_NOISE_ALBUM_ID,
  albumName: '白噪音',
  albumPic: LIGHT_COVER,
  albumPicDark: DARK_COVER,
  host: '',
  duration,
  onlineTime: 0,
  audioUrl: `${XMSLEEP_RAW}/${path}`,
  playbackMode: 'loop-one',
}));

export const CUSTOM_WHITE_NOISE_ALBUM = {
  id: CUSTOM_WHITE_NOISE_ALBUM_ID,
  name: '白噪音',
  description: '让雨声与风声，陪你安静抵达。',
  category: 'commute',
  episodeCount: CUSTOM_WHITE_NOISE_EPISODES.length,
  imageUrl: LIGHT_COVER,
  imageUrlDark: DARK_COVER,
  evergreen: true,
  latestEpisode: CUSTOM_WHITE_NOISE_EPISODES[0],
};

export function isCustomAlbumId(id) {
  return Number(id) === CUSTOM_WHITE_NOISE_ALBUM_ID;
}

export function isLoopingEpisode(episode) {
  return episode?.playbackMode === 'loop-one';
}

export function getCustomEpisodes(albumId, page = 1, pageSize = 30) {
  if (!isCustomAlbumId(albumId)) return null;
  const size = Math.max(1, Number(pageSize) || 30);
  const start = Math.max(0, ((Number(page) || 1) - 1) * size);
  const episodes = CUSTOM_WHITE_NOISE_EPISODES.slice(start, start + size);
  return {
    episodes,
    totalCount: CUSTOM_WHITE_NOISE_EPISODES.length,
    hasMore: start + episodes.length < CUSTOM_WHITE_NOISE_EPISODES.length,
  };
}
