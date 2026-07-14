import { cleanString } from './contentCollections.js';
import { resultToObjects } from './tokens.js';
import { createWork, getWork, updateWork } from './works.js';

const APP_CODE = 'travel-trail';

const DEMO_TRAILS = [
  {
    id: 'demo-travel-trail-suitcase',
    token: 'demo-travel-suitcase',
    workId: 'work-demo-travel-suitcase',
    title: '银色行李箱的夏天',
    subtitle: '每次出发前碰一下行李箱，回来后再把这一站接进人生轨迹。',
    objectLabel: '银色行李箱',
    themeColor: '#2f6f5e',
    nextPlace: '东京',
    nextPlaceNote: '下一站还没有成为过去，但它已经在箱子里轻轻发亮。',
    journeyState: 'planning',
    places: [
      { name: '上海虹桥站', note: '从这里拖着箱子出发。', visited_at: '2026-05-01' },
      { name: '京都', note: '雨落在石板路上，箱轮声变得很轻。', visited_at: '2026-05-03' },
      { name: '镰仓', note: '海风把行李牌吹得一直晃。', visited_at: '2026-05-06' },
    ],
  },
  {
    id: 'demo-travel-trail-camera',
    token: 'demo-travel-camera-bag',
    workId: 'work-demo-travel-camera-bag',
    title: '相机包的北方路线',
    subtitle: '它不记录 GPS，只记住那些真的抵达过的光线。',
    objectLabel: '黑色相机包',
    themeColor: '#3b5f7f',
    nextPlace: '呼伦贝尔',
    nextPlaceNote: '去看看风把草原推向哪里。',
    journeyState: 'planning',
    places: [
      { name: '北京', note: '出发前把备用电池塞进侧袋。', visited_at: '2026-04-12' },
      { name: '乌兰布统', note: '下午的光像慢慢铺开的毯子。', visited_at: '2026-04-14' },
      { name: '阿尔山', note: '镜头上有一点松针味。', visited_at: '2026-04-17' },
    ],
  },
  {
    id: 'demo-travel-trail-passport',
    token: 'demo-travel-passport',
    workId: 'work-demo-travel-passport',
    title: '护照夹的海风页',
    subtitle: '这条线不追求完整，只记录那些让人想回头看的抵达。',
    objectLabel: '棕色护照夹',
    themeColor: '#9a6a2f',
    nextPlace: '',
    nextPlaceNote: '',
    journeyState: 'returned',
    places: [
      { name: '广州', note: '把护照夹放进随身包最里层。', visited_at: '2026-03-02' },
      { name: '香港机场', note: '玻璃窗外的飞机像一排安静的鱼。', visited_at: '2026-03-03' },
      { name: '曼谷', note: '傍晚很热，街边的果汁很亮。', visited_at: '2026-03-04' },
      { name: '清迈', note: '这一站回来以后，整个人都慢了一点。', visited_at: '2026-03-08' },
    ],
  },
];

function getTrailByToken(db, token) {
  return resultToObjects(db.exec('SELECT id FROM travel_trails WHERE token = ? LIMIT 1', [token]))[0] || null;
}

function ensureWork(db, demo) {
  const existing = getWork(db, demo.workId);
  if (existing) return existing;

  return createWork(db, {
    id: demo.workId,
    title: demo.title,
    description: demo.subtitle,
    appCode: APP_CODE,
    intent: 'journey',
    status: 'active',
    tokenId: demo.id,
    token: demo.token,
    metadata: {
      objectLabel: demo.objectLabel,
      placeCount: demo.places.length,
      lastPlace: demo.places.at(-1)?.name || null,
      nextPlace: demo.nextPlace || null,
      journeyState: demo.journeyState,
      lifeQuestion: '我的人生走过了哪些地方？',
      seed: 'travel-trail-demo',
    },
  });
}

function insertDemoTrail(db, demo) {
  const work = ensureWork(db, demo);
  db.run(
    `INSERT INTO travel_trails
     (id, token, work_id, title, subtitle, object_label, next_place, next_place_note, journey_state, theme_color, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      demo.id,
      demo.token,
      work.id,
      demo.title,
      demo.subtitle,
      demo.objectLabel,
      cleanString(demo.nextPlace) || null,
      cleanString(demo.nextPlaceNote) || null,
      demo.journeyState,
      demo.themeColor,
    ]
  );

  demo.places.forEach((place, index) => {
    db.run(
      `INSERT INTO travel_trail_places
       (id, trail_id, name, note, visited_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        `${demo.id}-place-${index + 1}`,
        demo.id,
        place.name,
        place.note || null,
        place.visited_at || null,
        index,
      ]
    );
  });

  updateWork(db, work.id, {
    title: demo.title,
    description: demo.subtitle,
    appCode: APP_CODE,
    intent: 'journey',
    status: 'active',
    tokenId: demo.id,
    token: demo.token,
    versionNote: 'travel-trail-demo-seed',
    metadata: {
      objectLabel: demo.objectLabel,
      placeCount: demo.places.length,
      lastPlace: demo.places.at(-1)?.name || null,
      nextPlace: demo.nextPlace || null,
      journeyState: demo.journeyState,
      lifeQuestion: '我的人生走过了哪些地方？',
      seed: 'travel-trail-demo',
    },
  });
}

export function ensureTravelTrailDemoSeed(db) {
  for (const demo of DEMO_TRAILS) {
    if (getTrailByToken(db, demo.token)) continue;
    insertDemoTrail(db, demo);
  }
}
