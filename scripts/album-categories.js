// 车机端场景分类的自建映射（官方 API 无分类接口，2026-08-09 实测确认）。
// 分类名对齐车机端「场景 | 子类」格式。
// 命中优先级：人工 ID 映射 > 名称关键词规则 > null（未分类，走「更多专辑」兜底）。

export const SCENE_CATEGORIES = [
  { id: 'commute', label: '通勤场景', sub: '资讯速递' },
  { id: 'kids', label: '宝贝同行', sub: '哄娃陪伴' },
  { id: 'relax', label: '舒缓驾驶', sub: '乐伴旅途' },
  { id: 'longhaul', label: '长途驾驶', sub: '知识充电' },
  { id: 'city', label: '城市漫游', sub: '本地指南' },
  { id: 'car', label: '玩转爱车', sub: '提车必听' },
];

// 截图确认的人工映射（2026-08-09 车机端点播页可见专辑）。
const MANUAL_ALBUM_IDS = {
  commute: [799, 800, 30, 5, 23],
  kids: [35, 728, 741, 472, 458],
  relax: [306, 307, 11, 41, 669, 18, 661, 547],
  longhaul: [584, 577],
  city: [689, 692, 507, 356, 663, 107],
  car: [570, 438, 268, 308, 745, 735],
};

// 名称关键词规则（人工映射未命中时兜底）。
const NAME_RULES = [
  [/城市频道|城市资讯|天气预报|本地指南|城市漫游/, 'city'],
  [/咖啡|美食|吃喝玩乐|探店|玩乐地图|饭局/, 'city'],
  [/故事|绘本|童声|儿童|少年|亲子|宝宝|哄娃|宝贝/, 'kids'],
  [/音乐|乐行|乐动|歪波|精选集|weekend|dance|r&b|电音|古典|点唱机/i, 'relax'],
  [/资讯|新闻|早间|晚间|速递|报道/, 'commute'],
  [/提车|用车|爱车|约fan|驾驶|车友|保养|赛车/, 'car'],
  [/商业|创业|投资|财经|科技|互联网|知识|科普|历史|读书|书房/, 'longhaul'],
];

const manualById = new Map();
for (const [categoryId, ids] of Object.entries(MANUAL_ALBUM_IDS)) {
  for (const id of ids) manualById.set(Number(id), categoryId);
}

export function categorizeAlbumName(name) {
  const matched = NAME_RULES.find(([pattern]) => pattern.test(name || ''));
  return matched ? matched[1] : null;
}

export function categorizeAlbum(album) {
  if (!album) return null;
  const manual = manualById.get(Number(album.id));
  if (manual) return manual;
  return categorizeAlbumName(album.name);
}
