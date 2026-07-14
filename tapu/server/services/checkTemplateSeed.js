import { v4 as uuidv4 } from 'uuid';
import { resultToObjects } from './tokens.js';

const CHECK_TEMPLATES = [
  {
    id: 'travel-check',
    name: '旅行 Check',
    scenario: 'travel',
    object_hint: '行李箱 / 护照夹',
    description: '出发前确认最难补救的东西都在身边。',
    theme_color: '#2f6f5e',
    items: [
      ['证件 / 护照', '最难补救'],
      ['充电器', '线和头都看一眼'],
      ['钥匙 / 门卡', '回来的入口'],
      ['常用药', '别指望路上买'],
      ['耳机', '路上的小房间'],
      ['伞 / 外套', '天气会有性格'],
      ['洗漱小包', '牙刷最会缺席'],
      ['现金 / 银行卡', '给意外留条路'],
    ],
  },
  {
    id: 'camera-check',
    name: '摄影 Check',
    scenario: 'photography',
    object_hint: '相机包',
    description: '出门拍摄前，把那些小而致命的缺席先拦住。',
    theme_color: '#3b5f7f',
    items: [
      ['相机机身', '开机确认一次'],
      ['镜头', '按今天的拍摄选择'],
      ['电池', '至少一块满电备用'],
      ['存储卡', '空卡比灵感更重要'],
      ['充电器 / 读卡器', '回去交片要靠它'],
      ['清洁布', '镜头上的指纹很诚实'],
      ['肩带 / 快挂', '别让手腕硬扛'],
      ['雨罩 / 防潮袋', '天气不总讲道理'],
    ],
  },
  {
    id: 'camping-check',
    name: '露营 Check',
    scenario: 'camping',
    object_hint: '露营箱 / 装备包',
    description: '把营地真正需要的东西装进同一个确认动作里。',
    theme_color: '#7a5a34',
    items: [
      ['帐篷 / 天幕', '先确认主体在包里'],
      ['地钉 / 风绳', '少一个就会很狼狈'],
      ['睡袋 / 防潮垫', '夜里才知道重要'],
      ['炉具 / 气罐', '火种和燃料一起看'],
      ['头灯 / 电池', '黑下来以后才想起就晚了'],
      ['垃圾袋', '把自然还给自然'],
      ['急救包', '小伤口也要被照顾'],
      ['保温杯 / 水袋', '水永远不嫌多'],
    ],
  },
  {
    id: 'stroller-check',
    name: '婴儿车 Check',
    scenario: 'stroller',
    object_hint: '婴儿车 / 妈咪包',
    description: '带小朋友出门前，给照护者一个轻一点的确认动作。',
    theme_color: '#c47c68',
    items: [
      ['纸尿裤', '多一片通常没坏处'],
      ['湿巾 / 纸巾', '几乎一定会用到'],
      ['奶瓶 / 水杯', '出门前看一眼容量'],
      ['备用衣物', '小朋友有自己的天气'],
      ['安抚玩具', '路上的小伙伴'],
      ['围兜 / 小毛巾', '吃饭前后都需要'],
      ['防晒 / 帽子', '晴天的温柔保护'],
      ['垃圾袋', '把混乱装起来'],
    ],
  },
];

export function ensureCheckTemplatesSeed(db) {
  for (const template of CHECK_TEMPLATES) {
    db.run(
      `INSERT OR IGNORE INTO check_templates
       (id, name, scenario, description, object_hint, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [
        template.id,
        template.name,
        template.scenario,
        template.description,
        template.object_hint,
        template.theme_color,
      ]
    );

    const existingItems = resultToObjects(db.exec(
      'SELECT id FROM check_template_items WHERE template_id = ? LIMIT 1',
      [template.id]
    ));
    if (existingItems.length) continue;

    template.items.forEach(([label, hint], index) => {
      db.run(
        `INSERT INTO check_template_items
         (id, template_id, label, hint, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), template.id, label, hint, index]
      );
    });
  }
}
