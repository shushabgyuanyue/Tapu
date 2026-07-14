const BUILT_IN_APPLICATIONS = [
  {
    name: '情绪 IP',
    code: 'emotion-ip',
    interaction_type: 'tap_to_emotion_content',
    description: '实体承载情绪表达，触碰后进入对应内容。',
    status: 'active',
  },
  {
    name: '手账慢故事贴纸',
    code: 'daily-sticker',
    interaction_type: 'tap_to_slow_story',
    description: '一枚贴纸进入一个连续更新的小世界。',
    status: 'active',
  },
  {
    name: '答案之书',
    code: 'answer-book',
    interaction_type: 'tap_to_mindful_answer',
    description: '触碰现实物体，随机获得一张克制、正念式回应卡。',
    status: 'active',
  },
  {
    name: '纪念瞬间',
    code: 'moment',
    interaction_type: 'tap_to_saved_moment',
    description: '把一个值得纪念的时刻封存在可触碰的物里。',
    status: 'active',
  },
  {
    name: '旅行轨迹',
    code: 'travel-trail',
    interaction_type: 'tap_to_travel_trace',
    description: '贴在行李或旅行物件上，触碰后把去过的地点画成一条动态轨迹。',
    status: 'active',
  },
];

export function getBuiltInApplications() {
  return BUILT_IN_APPLICATIONS;
}

export function ensureApplicationRegistry(db) {
  for (const app of BUILT_IN_APPLICATIONS) {
    db.run(
      `INSERT INTO applications (id, name, code, interaction_type, description, status)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         interaction_type = excluded.interaction_type,
         description = excluded.description,
         status = excluded.status`,
      [
        app.code,
        app.name,
        app.code,
        app.interaction_type,
        app.description,
        app.status,
      ]
    );
  }
}
