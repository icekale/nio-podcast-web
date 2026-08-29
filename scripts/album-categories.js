// 官方 API 无分类字段。命中顺序：人工 ID > 自动规则 > null（更多专辑）。
export const TOPIC_CATEGORIES = [
  { id: 'news', label: '资讯热点' },
  { id: 'car', label: '汽车蔚来' },
  { id: 'business', label: '商业科技' },
  { id: 'culture', label: '文化知识' },
  { id: 'lifestyle', label: '生活兴趣' },
  { id: 'audio', label: '音乐声音' },
  { id: 'kids', label: '亲子成长' },
];

const TOPIC_PRIORITY = ['car', 'kids', 'audio', 'news', 'business', 'culture', 'lifestyle'];

const MANUAL_ALBUM_IDS = {
  news: [799, 800, 30, 5, 23, 507, 356, 663, 107],
  kids: [35, 728, 741, 472, 458],
  audio: [306, 307, 11, 41, 669, 18, 661, 547, 394],
  culture: [584, 577],
  lifestyle: [689, 692, 401],
  car: [570, 438, 268, 308, 745, 735],
};

const NAME_RULES = [
  ['car', /蔚来|nio\b|onvo|乐道|萤火虫|提车|用车|爱车|约fan|驾驶|车友|保养|赛车|formula|es8|es9|et9|ec6|换电|车展|发布会|老司机|直通车|驾趣|nio day|nomi|蔚友|车机|蔚爱|阅蔚|同频|李斌|苏苏福福|王安宇|加电|牛屋|wo的车|玩转wo|蔚星/i],
  ['kids', /绘本|童声|儿童|少年|亲子|宝宝|哄娃|宝贝|童话|寓言|儿歌|家庭教育|孩子|拼读|汤姆·索亚|金龟子|小小少年|恐龙|礼貌|胡小闹|呼噜西游|亚斯与莉莉|黏糊糊|童言|萌宠补习|王国》儿童|安武林|米雪老师|海洋奇妙|超人救援|动物剧场|神奇动物|必读故事/],
  ['audio', /音乐|乐行|乐动|歪波|点唱机|点歌|电台|歌单|热歌|音乐会|乐光|乐章|band\b|dance|r&b|电音|古典|白噪音|vibration|weekend dance|年代电台|歌歌歌歌|自成音浪|seeds精选|hit music/i],
  ['news', /资讯|新闻|早间|晚间|速递|报道|早报|晚报|天气预报|城市频道|城市资讯|观察局|前方加速度|充电站|世界杯|摸鱼早报/],
  ['business', /商业|创业|投资|财经|科技|互联网|人工智能|\bai\b|工业|职场|经济|品牌|硅谷|编码|debug|tech talk|疯投|组织进化|一人公司|搞钱|美市|slow brand|果壳|十字路口/i],
  ['culture', /历史|文化|读书|书房|知识|科普|博物|艺术|文学|人文|诗词|唐诗|读库|世界史|节气|哲学|人物|讲堂|n问|生命周刊|魔法书|大宋|唐砖|汉乡|奥术|了不起的女性|城市记忆|城市地图|汉声/i],
  ['lifestyle', /生活|健康|养生|旅行|漫游|美食|咖啡|酒|运动|体育|游戏|电影|时尚|探店|玩乐地图|饭局|影视|健身|宠物|萌宠|目的地|吃喝|宵夜|律师|法律|机核|体育地平线|探险|杂谈|乱劈柴|百事有感觉|吃吃白相|fun游|津津有味|不开玩笑|映画|好梗|大口说|去现场|打工人|周刊|喜剧|剧场|剧谈|律师生活|海獭|脑筋|广播剧/i],
];

const manualById = new Map();
for (const [categoryId, ids] of Object.entries(MANUAL_ALBUM_IDS)) {
  for (const id of ids) manualById.set(Number(id), categoryId);
}

function matchTopic(text) {
  if (!text) return null;
  const hits = NAME_RULES.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
  return TOPIC_PRIORITY.find(id => hits.includes(id)) || null;
}

export function categorizeAlbumName(name) {
  return matchTopic(name);
}

export function categorizeAlbum(album) {
  if (!album) return null;
  const manual = manualById.get(Number(album.id));
  if (manual) return manual;
  return matchTopic([album.name, album.description, album.latestEpisode?.title].filter(Boolean).join('\n'));
}

export function reportCategoryCoverage(albums, log = console) {
  const counts = Object.fromEntries(TOPIC_CATEGORIES.map(category => [category.id, 0]));
  const unknownAlbums = [];
  for (const album of albums || []) {
    if (album?.category && counts[album.category] != null) counts[album.category] += 1;
    else unknownAlbums.push(album);
  }
  const total = (albums || []).length;
  const unknown = unknownAlbums.length;
  const ratio = total ? unknown / total : 0;
  log.log(`Category coverage: ${TOPIC_CATEGORIES.map(category => `${category.id}=${counts[category.id]}`).join(' ')} unknown=${unknown}/${total} (${(ratio * 100).toFixed(1)}%)`);
  if (unknown) {
    log.log('Unclassified albums:');
    for (const album of unknownAlbums) log.log(`${album?.id ?? '?'}\t${album?.name ?? ''}`);
  }
  if (ratio > 0.12) log.warn(`WARNING: unclassified albums exceed 12% (${(ratio * 100).toFixed(1)}%)`);
  return { counts, unknown, total, ratio };
}
