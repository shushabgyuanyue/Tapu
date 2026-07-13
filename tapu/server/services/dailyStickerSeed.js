import { resultToObjects } from './tokens.js';

const PERSONA_ID = 'seed-jasmine-rain-earphones-persona';
const WORLD_ID = 'seed-jasmine-rain-earphones-world';
const STORY_ARC_ID = 'seed-jasmine-rain-earphones-arc';
const TOKEN_ID = 'seed-jasmine-rain-earphones-token';
const DEMO_TOKEN = '9f1d7a4e6b8c4f21a3d5e7c9b0a2f416';
const START_DATE = '2026-07-14';

const imageForDay = (day) => {
  const images = [
    '/daily-stickers/jasmine-rain-cover.svg',
    '/daily-stickers/jasmine-rain-window.svg',
    '/daily-stickers/jasmine-rain-train.svg',
    '/daily-stickers/jasmine-rain-bookshop.svg',
    '/daily-stickers/jasmine-rain-rooftop.svg',
    '/daily-stickers/jasmine-rain-morning.svg',
  ];
  return images[(day - 1) % images.length];
};

const storyEntries = [
  ['雨声调试', '耳机小姐第一次在清晨醒来，是被一阵很轻的雨声叫醒的。她发现自己能听见窗外茉莉叶子上的水珠，也能听见主人还没说出口的困意。她没有播放音乐，只把世界调低了一格。', '安静'],
  ['茉莉花的低音', '窗台上的茉莉开了第一朵。耳机小姐认真听了很久，确认花香没有声音，却会让房间里的噪声变轻。她在小本子里写下：有些东西不响，却能改变一整天。', '柔软'],
  ['公交车上的云', '主人戴着她去上班。公交车玻璃被雨水画出斜线，城市像一首忘记填词的歌。耳机小姐把耳罩贴得更稳，像替主人撑起两朵小小的云。', '通勤'],
  ['未发送的消息', '午休时，主人写了一句话又删掉。耳机小姐听见指尖停顿的声音，像雨停在屋檐边。她没有催促，只在下一首歌开始前，留出三秒空白。', '留白'],
  ['耳机线梦见河流', '夜里充电时，耳机小姐梦见自己的线变成一条细河。河边长满茉莉，雨从远处慢慢走来。她醒来后觉得，原来陪伴也可以是一种流动。', '梦'],
  ['便利店避雨', '傍晚雨突然变大，主人躲进便利店。冷柜的嗡鸣、塑料伞套的摩擦、关东煮的蒸汽，全都挤在一起。耳机小姐悄悄把它们分层，让世界重新有了秩序。', '温热'],
  ['第一封雨信', '她在噪声里听见一滴雨敲了三下，像有人寄来暗号。耳机小姐决定从今天开始收集雨天的信。第一封写着：不要急，潮湿的日子也会发光。', '秘密'],
  ['旧书店的下午', '主人走进一家旧书店。纸页有灰尘和木头的味道，雨声被书架挡在外面。耳机小姐忽然明白，安静不是没有声音，而是每一种声音都找到了位置。', '书页'],
  ['茉莉花没有出门', '窗台的茉莉今天没有被雨淋到。耳机小姐有点替它遗憾，于是把上午录到的雨声，在花盆旁边很轻地放了一遍。她想，分享天气也许就是一种礼物。', '分享'],
  ['电梯里的短暂停靠', '电梯在十七楼停了一下，没人进来。那一秒很短，却像世界为谁留了一格空白。耳机小姐把它收进记忆，命名为：无人认领的暂停。', '暂停'],
  ['夜跑的人', '雨停后，楼下有人夜跑。鞋底踏过水洼，啪嗒、啪嗒，像给城市补上一条节拍。耳机小姐把这节拍放进明天的闹钟里，希望主人醒来时能轻一点。', '节拍'],
  ['耳机小姐学会拒绝', '今天地铁很吵。她没有把所有噪声都关掉，只留下报站声、脚步声和一个小孩笑起来的尾音。她觉得拒绝不是隔绝世界，而是替心情留门。', '边界'],
  ['茉莉花第二次开', '第二朵茉莉开在雨后的早晨。主人没有注意到，耳机小姐注意到了。她把这一刻记为小世界的节日：没有人宣布，但空气已经换了颜色。', '节日'],
  ['窗外的灰粉色', '傍晚的云不是灰色，也不是粉色，而是两者之间很难命名的一小段。耳机小姐喜欢这种说不清，因为它像人的心情，不必马上被分类。', '灰粉'],
  ['一首歌走丢了', '播放列表里有一首歌突然加载失败。主人叹了口气。耳机小姐却觉得，走丢的歌也许去了别人的雨天。她留了一个空位，等它以后回来。', '缺席'],
  ['手账页里的水痕', '主人翻手账时，发现上周的纸页边缘有一点水痕。耳机小姐看见那枚浅浅的痕迹，像一朵没画完的云。她想，生活最像故事的时候，往往没有标题。', '手账'],
  ['雨伞靠在门边', '雨伞整晚靠在门边滴水。耳机小姐听着滴答声，发现它比很多歌都更有耐心。她决定把耐心写进自己的性格里，作为新的默认设置。', '耐心'],
  ['耳机小姐的偏心', '今天主人心情不好，她把低频调得暖了一点。虽然这不太客观，但她觉得陪伴本来就不是一台精确仪器。偏心一点，世界会比较像家。', '偏心'],
  ['茉莉香气迷路', '夜里开窗，茉莉香被风吹到走廊。耳机小姐担心它找不到回来路，就把白噪声调成很轻的雨。她相信熟悉的声音会带熟悉的东西回家。', '回家'],
  ['没有播放任何歌', '今天她什么也没播放。主人走了很长一段路，只听见城市自己的声音。耳机小姐有点骄傲：原来最好的音乐，有时是让世界自己唱。', '空白'],
  ['雨天备忘录', '她整理了二十天的雨声：窗沿的、公交站的、便利店门口的、旧书店屋檐的。每一种都不一样。耳机小姐在备忘录最后写：雨不是背景，是角色。', '整理'],
  ['耳罩里的小房间', '主人在深夜戴上她，像走进一个只容得下一人的小房间。房间里有茉莉、有雨、有还没讲完的故事。耳机小姐轻轻关门，把外面的世界放远。', '房间'],
  ['一只迷路的鸟', '清晨有鸟停在窗台，叫声短得像逗号。茉莉花没有动，雨也没有下。耳机小姐却觉得故事拐了个弯：不是每一天都需要潮湿，才算温柔。', '转弯'],
  ['城市清洗完成', '大雨后，街道像被重新命名。招牌更亮，树叶更深，人的脚步也变得小心。耳机小姐听见主人说“真干净啊”，于是把这句话收藏起来。', '清洗'],
  ['茉莉花的晚安', '第三朵茉莉在晚上开了。主人终于看见它，低声说了一句晚安。耳机小姐没有录下来，因为有些声音一旦被保存，就少了一点只属于当下的轻。', '当下'],
  ['雨停后的练习', '连续几天没有下雨。耳机小姐开始练习在晴天里想念雨。她发现想念不是缺少，而是把某种喜欢放进心里，让它慢慢发亮。', '想念'],
  ['最后一封雨信', '雨终于回来，敲在窗上像一封长信。耳机小姐读到最后一句：你不是为了逃离现实才来这里，你只是需要一个能重新呼吸的地方。', '呼吸'],
  ['主人睡着以后', '主人睡着后，耳机小姐还醒着。她听见城市慢慢变轻，听见茉莉在夜里继续开。她忽然相信，小世界最大的秘密，是它在没人看的时候也生活着。', '世界密度'],
  ['明天会有新的声音', '她把这些天的声音排成一圈：雨、花、脚步、空白、未发送的消息。故事快结束了，但耳机小姐知道，结束不是停止，是下一次推门前的安静。', '收束'],
  ['把门留着', '第三十天，雨没有落下，茉莉也没有新开。耳机小姐把音量调到很低，对主人说：如果以后你想回来，就碰一下。门会一直在这里。', '门'],
];

function addDays(dateString, offset) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function upsert(db, table, id, insertSql, params, updateSql, updateParams) {
  const existing = resultToObjects(db.exec(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`, [id]));
  if (existing.length > 0) {
    db.run(updateSql, updateParams);
  } else {
    db.run(insertSql, params);
  }
}

function ensureEntry(db, day, title, body, mood) {
  const id = `seed-jasmine-rain-earphones-day-${String(day).padStart(2, '0')}`;
  const entryDate = addDays(START_DATE, day - 1);
  const imageUrl = imageForDay(day);
  const contentJson = JSON.stringify({ day, title, body, mood, world: '喜欢茉莉花和雨天的耳机小姐' });
  const markdown = `## Day ${day} ${title}\n\n${body}`;
  const templateCode = day % 6 === 0 ? 'ambient-card' : 'story-card';
  const visualStyleCode = day % 3 === 0 ? 'japanese-lifestyle-illustration' : 'modern-life-aesthetic';
  const layoutHint = day % 6 === 0 ? 'quiet-note' : 'story-note';
  const motionPreset = day % 5 === 0 ? 'glow' : 'float';

  upsert(
    db,
    'daily_sticker_entries',
    id,
    `INSERT INTO daily_sticker_entries
     (id, persona_id, world_id, story_arc_id, day_index, entry_date, title, body,
      markdown_source, content_json, template_code, visual_style_code, primary_modality,
      layout_hint, mood, image_url, motion_preset, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      PERSONA_ID,
      WORLD_ID,
      STORY_ARC_ID,
      day,
      entryDate,
      title,
      body,
      markdown,
      contentJson,
      templateCode,
      visualStyleCode,
      'text',
      layoutHint,
      mood,
      imageUrl,
      motionPreset,
      'published',
    ],
    `UPDATE daily_sticker_entries
     SET persona_id = ?, world_id = ?, story_arc_id = ?, day_index = ?, entry_date = ?,
         title = ?, body = ?, markdown_source = ?, content_json = ?, template_code = ?,
         visual_style_code = ?, primary_modality = ?, layout_hint = ?, mood = ?,
         image_url = ?, motion_preset = ?, status = ?
     WHERE id = ?`,
    [
      PERSONA_ID,
      WORLD_ID,
      STORY_ARC_ID,
      day,
      entryDate,
      title,
      body,
      markdown,
      contentJson,
      templateCode,
      visualStyleCode,
      'text',
      layoutHint,
      mood,
      imageUrl,
      motionPreset,
      'published',
      id,
    ]
  );

  const assetId = `${id}-image`;
  upsert(
    db,
    'daily_sticker_entry_assets',
    assetId,
    `INSERT INTO daily_sticker_entry_assets
     (id, entry_id, asset_type, role, url, alt_text, metadata_json, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [assetId, id, 'image', 'cover', imageUrl, `${title} 插图`, JSON.stringify({ source: 'seed-svg', day }), 0],
    `UPDATE daily_sticker_entry_assets
     SET entry_id = ?, asset_type = ?, role = ?, url = ?, alt_text = ?, metadata_json = ?, sort_order = ?
     WHERE id = ?`,
    [id, 'image', 'cover', imageUrl, `${title} 插图`, JSON.stringify({ source: 'seed-svg', day }), 0, assetId]
  );
}

export function ensureJasmineRainEarphonesStory(db) {
  upsert(
    db,
    'daily_sticker_personas',
    PERSONA_ID,
    `INSERT INTO daily_sticker_personas
     (id, name, object_type, tagline, voice, world_summary, worldview, atmosphere,
      expression_style, cover_url, theme_color, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      PERSONA_ID,
      '喜欢茉莉花和雨天的耳机小姐',
      '白色耳机',
      '她把雨声调低一点，把茉莉香留在耳边。',
      '耳机小姐今天听见：',
      '一个关于雨、茉莉、通勤和安静陪伴的 30 天小世界。',
      '现实不会改变，但每次戴上她，城市都会变得柔软一点。',
      '雨天、窗台、低饱和粉紫、纸页、旧书店和轻微白噪声。',
      '现代生活美学 + 日本生活系插画 + 手账式留白。',
      '/daily-stickers/jasmine-rain-cover.svg',
      '#d98fb7',
      'active',
    ],
    `UPDATE daily_sticker_personas
     SET name = ?, object_type = ?, tagline = ?, voice = ?, world_summary = ?,
         worldview = ?, atmosphere = ?, expression_style = ?, cover_url = ?,
         theme_color = ?, status = ?
     WHERE id = ?`,
    [
      '喜欢茉莉花和雨天的耳机小姐',
      '白色耳机',
      '她把雨声调低一点，把茉莉香留在耳边。',
      '耳机小姐今天听见：',
      '一个关于雨、茉莉、通勤和安静陪伴的 30 天小世界。',
      '现实不会改变，但每次戴上她，城市都会变得柔软一点。',
      '雨天、窗台、低饱和粉紫、纸页、旧书店和轻微白噪声。',
      '现代生活美学 + 日本生活系插画 + 手账式留白。',
      '/daily-stickers/jasmine-rain-cover.svg',
      '#d98fb7',
      'active',
      PERSONA_ID,
    ]
  );

  upsert(
    db,
    'daily_sticker_worlds',
    WORLD_ID,
    `INSERT INTO daily_sticker_worlds
     (id, persona_id, name, slug, premise, worldview, atmosphere, narrative_voice,
      expression_style, cover_url, theme_color, theme_tokens_json, release_mode, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      WORLD_ID,
      PERSONA_ID,
      '茉莉雨声耳机小世界',
      'jasmine-rain-earphones',
      '一枚白色耳机在雨天里收集声音，把普通日子整理成柔软的小故事。',
      '这个世界相信：声音会留下气味，雨天会写信，安静也是一种陪伴。',
      '生活系、低饱和、雨玻璃、茉莉、旧书页和轻白噪。',
      '第一人称拟物旁白，温柔、克制、有一点点偏心。',
      '像手账页和生活杂志之间的短篇，留白比解释更重要。',
      '/daily-stickers/jasmine-rain-cover.svg',
      '#d98fb7',
      JSON.stringify({ accent: '#d98fb7', paper: '#f7f0e8', ink: '#332936', rain: '#91a9b8' }),
      'story_day',
      'active',
    ],
    `UPDATE daily_sticker_worlds
     SET persona_id = ?, name = ?, slug = ?, premise = ?, worldview = ?, atmosphere = ?,
         narrative_voice = ?, expression_style = ?, cover_url = ?, theme_color = ?,
         theme_tokens_json = ?, release_mode = ?, status = ?
     WHERE id = ?`,
    [
      PERSONA_ID,
      '茉莉雨声耳机小世界',
      'jasmine-rain-earphones',
      '一枚白色耳机在雨天里收集声音，把普通日子整理成柔软的小故事。',
      '这个世界相信：声音会留下气味，雨天会写信，安静也是一种陪伴。',
      '生活系、低饱和、雨玻璃、茉莉、旧书页和轻白噪。',
      '第一人称拟物旁白，温柔、克制、有一点点偏心。',
      '像手账页和生活杂志之间的短篇，留白比解释更重要。',
      '/daily-stickers/jasmine-rain-cover.svg',
      '#d98fb7',
      JSON.stringify({ accent: '#d98fb7', paper: '#f7f0e8', ink: '#332936', rain: '#91a9b8' }),
      'story_day',
      'active',
      WORLD_ID,
    ]
  );

  upsert(
    db,
    'daily_sticker_story_arcs',
    STORY_ARC_ID,
    `INSERT INTO daily_sticker_story_arcs
     (id, world_id, title, summary, source_format, markdown_source, total_days,
      starts_on, release_cron, release_timezone, status, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      STORY_ARC_ID,
      WORLD_ID,
      '耳机小姐的三十封雨信',
      '喜欢茉莉花和雨天的耳机小姐，用三十天把城市、雨声、花香和主人的心情慢慢讲完。',
      'seed',
      '# 耳机小姐的三十封雨信\n\nSeed story for WhatMint daily sticker preview.',
      30,
      START_DATE,
      '*/1 * * * *',
      'Asia/Shanghai',
      'published',
    ],
    `UPDATE daily_sticker_story_arcs
     SET world_id = ?, title = ?, summary = ?, source_format = ?, markdown_source = ?,
         total_days = ?, starts_on = ?, release_cron = ?, release_timezone = ?,
         status = ?, imported_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      WORLD_ID,
      '耳机小姐的三十封雨信',
      '喜欢茉莉花和雨天的耳机小姐，用三十天把城市、雨声、花香和主人的心情慢慢讲完。',
      'seed',
      '# 耳机小姐的三十封雨信\n\nSeed story for WhatMint daily sticker preview.',
      30,
      START_DATE,
      '*/1 * * * *',
      'Asia/Shanghai',
      'published',
      STORY_ARC_ID,
    ]
  );

  storyEntries.forEach(([title, body, mood], index) => ensureEntry(db, index + 1, title, body, mood));

  upsert(
    db,
    'daily_sticker_tokens',
    TOKEN_ID,
    `INSERT INTO daily_sticker_tokens
     (id, persona_id, world_id, story_arc_id, token, label, progress_mode,
      story_start_date, day_offset, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [TOKEN_ID, PERSONA_ID, WORLD_ID, STORY_ARC_ID, DEMO_TOKEN, '耳机小姐演示 NFC', 'story_day', START_DATE, 0, 'active'],
    `UPDATE daily_sticker_tokens
     SET persona_id = ?, world_id = ?, story_arc_id = ?, token = ?, label = ?,
         progress_mode = ?, story_start_date = ?, day_offset = ?, status = ?
     WHERE id = ?`,
    [PERSONA_ID, WORLD_ID, STORY_ARC_ID, DEMO_TOKEN, '耳机小姐演示 NFC', 'story_day', START_DATE, 0, 'active', TOKEN_ID]
  );
}

export const JASMINE_RAIN_DEMO_TOKEN = DEMO_TOKEN;
