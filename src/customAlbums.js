export const CUSTOM_WHITE_NOISE_ALBUM_ID = 900001;

const CUSTOM_EPISODE_BASE_ID = 900001000;
// 音频已镜像到 public/audio/，源自 XMSLEEP 仓库
// revision 3fd6fcb03aa5bf60e35bfa7c69a2c465385ea629（见 THIRD_PARTY_NOTICES.md）
const AUDIO_BASE = 'audio';
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
  ['呼啸的风', 52841, 'nature/howling-wind.ogg'],
  ['雪中行走', 35960, 'nature/walk-in-snow.ogg'],
  ['踩踏树叶', 19881, 'nature/walk-on-leaves.ogg'],
  ['踩踏碎石', 69680, 'nature/walk-on-gravel.ogg'],
  ['丛林', 257480, 'nature/jungle.ogg'],
  ['田野', 397881, 'nature/field.ogg'],
  ['湖泊', 41535, 'nature/lake.ogg'],
  ['雨落雨披', 64668, 'rain/rain-on-raincoat.ogg'],
  ['雨敲木屋', 56517, 'rain/rain-on-wooden-house.ogg'],
  ['屋檐雨声', 40960, 'rain/rain-on-eaves.ogg'],
  ['鸟鸣', 115119, 'animals/birds.ogg'],
  ['海鸥', 43475, 'animals/seagulls.ogg'],
  ['蟋蟀', 172538, 'animals/crickets.ogg'],
  ['狼嚎', 55371, 'animals/wolf.ogg'],
  ['猫头鹰', 12943, 'animals/owl.ogg'],
  ['青蛙', 78648, 'animals/frog.ogg'],
  ['狗叫', 16179, 'animals/dog-barking.ogg'],
  ['马奔腾', 9143, 'animals/horse-gallop.ogg'],
  ['猫咪呼噜', 38662, 'animals/cat-purring.ogg'],
  ['乌鸦', 58078, 'animals/crows.ogg'],
  ['鲸鱼', 30006, 'animals/whale.ogg'],
  ['蜂巢', 45155, 'animals/beehive.ogg'],
  ['啄木鸟', 15319, 'animals/woodpecker.ogg'],
  ['鸡', 202076, 'animals/chickens.ogg'],
  ['牛', 59699, 'animals/cows.ogg'],
  ['羊', 31194, 'animals/sheep.ogg'],
  ['高速公路', 132503, 'urban/highway.ogg'],
  ['道路', 102353, 'urban/road.ogg'],
  ['救护车警笛', 22589, 'urban/ambulance-siren.ogg'],
  ['繁忙街道', 175356, 'urban/busy-street.ogg'],
  ['人群', 72563, 'urban/crowd.ogg'],
  ['交通', 39890, 'urban/traffic.ogg'],
  ['烟花', 34495, 'urban/fireworks.ogg'],
  ['机场', 311610, 'places/airport.ogg'],
  ['教堂', 70479, 'places/church.ogg'],
  ['寺庙', 91617, 'places/temple.ogg'],
  ['建筑工地', 125049, 'places/construction-site.ogg'],
  ['水下', 43249, 'places/underwater.ogg'],
  ['拥挤酒吧', 58735, 'places/crowded-bar.ogg'],
  ['夜晚村庄', 106417, 'places/night-village.ogg'],
  ['超市', 175094, 'places/supermarket.ogg'],
  ['旋转木马', 160764, 'places/carousel.ogg'],
  ['实验室', 21234, 'places/laboratory.ogg'],
  ['洗衣房', 32484, 'places/laundry-room.ogg'],
  ['餐厅', 170887, 'places/restaurant.ogg'],
  ['厨房烹饪', 66500, 'places/kitchen.ogg'],
  ['潜艇', 46032, 'transport/submarine.ogg'],
  ['帆船', 160521, 'transport/sailboat.ogg'],
  ['划船', 25535, 'transport/rowing-boat.ogg'],
  ['键盘', 12147, 'things/keyboard.ogg'],
  ['打字机', 21781, 'things/typewriter.ogg'],
  ['纸张', 17209, 'things/paper.ogg'],
  ['时钟', 15940, 'things/clock.ogg'],
  ['风铃', 83009, 'things/wind-chimes.ogg'],
  ['颂钵', 49082, 'things/singing-bowl.ogg'],
  ['吊扇', 15593, 'things/ceiling-fan.ogg'],
  ['烘干机', 28025, 'things/dryer.ogg'],
  ['幻灯机', 142884, 'things/slide-projector.ogg'],
  ['沸水', 18498, 'things/boiling-water.ogg'],
  ['气泡', 6390, 'things/bubbles.ogg'],
  ['调频收音机', 70230, 'things/tuning-radio.ogg'],
  ['摩尔斯电码', 75388, 'things/morse-code.ogg'],
  ['洗衣机', 22530, 'things/washing-machine.ogg'],
  ['黑胶效果', 65901, 'things/vinyl-effect.ogg'],
  ['雨刷', 15124, 'things/windshield-wipers.ogg'],
  ['掏耳朵1', 32616, 'things/ear-cleaning-1.ogg'],
  ['掏耳朵2', 124704, 'things/ear-cleaning-2.ogg'],
  ['吉他', 31627, 'things/guitar.ogg'],
  ['轻钢琴', 103027, 'things/light-piano.ogg'],
  ['古筝', 149040, 'things/guzheng.ogg'],
  ['优雅钢琴', 173521, 'things/优雅钢琴.ogg'],
  ['冥想琴音', 55819, 'things/冥想琴音.ogg'],
  ['发呆音', 150951, 'things/发呆音.ogg'],
  ['学习', 48651, 'noise/study.ogg'],
  ['吃薯片', 51965, 'noise/eating-chips.ogg'],
  ['钢琴声', 128000, 'noise/piano.ogg'],
  ['夏夜虫鸣', 40587, 'nature/夏夜虫鸣.ogg'],
  ['雨棚', 38010, 'rain/雨棚.ogg'],
  ['小雨加风', 28606, 'rain/小雨加风.ogg'],
  ['尖尖流雨', 55819, 'rain/尖尖流雨.ogg'],
  ['敞亮雨', 38010, 'rain/敞亮雨.ogg'],
  ['顶棚雨', 110084, 'rain/顶棚雨.ogg'],
  ['屋檐落雨', 22081, 'rain/屋檐落雨.ogg'],
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
  audioUrl: `${AUDIO_BASE}/${path}`,
  playbackMode: 'loop-one',
}));

export const CUSTOM_WHITE_NOISE_ALBUM = {
  id: CUSTOM_WHITE_NOISE_ALBUM_ID,
  name: '白噪音',
  description: '让雨声与风声，陪你安静抵达。',
  directorySubtitle: '让雨声与风声，陪你安静抵达。',
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
