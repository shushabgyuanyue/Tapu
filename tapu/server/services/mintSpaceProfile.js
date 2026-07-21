import { resultToObjects } from './tokens.js';
import { mintSpaceCopy } from '../copy/mintSpace.js';

const BASE_AXES = {
  warmth: 0.42,
  motion: 0.34,
  mystery: 0.32,
  guarding: 0.36,
  memory: 0.38,
  ritual: 0.30,
};

const IP_PRESETS = [
  {
    key: 'tissue_puppy',
    match: ['纸巾', '小狗', 'tissue', 'puppy'],
    role: mintSpaceCopy.presets.tissuePuppy.role,
    statusLine: mintSpaceCopy.presets.tissuePuppy.statusLine,
    traits: mintSpaceCopy.presets.tissuePuppy.traits,
    axes: { warmth: 0.95, guarding: 0.78, memory: 0.48, ritual: 0.36, motion: 0.24, mystery: 0.18 },
  },
  {
    key: 'answer_book',
    match: ['答案', '书', 'answer', 'book'],
    role: mintSpaceCopy.presets.answerBook.role,
    statusLine: mintSpaceCopy.presets.answerBook.statusLine,
    traits: mintSpaceCopy.presets.answerBook.traits,
    axes: { mystery: 0.92, memory: 0.72, ritual: 0.58, warmth: 0.42, guarding: 0.34, motion: 0.18 },
  },
  {
    key: 'blessing_puppy',
    match: ['祈福', '祝愿', 'blessing', 'wish'],
    role: mintSpaceCopy.presets.blessingPuppy.role,
    statusLine: mintSpaceCopy.presets.blessingPuppy.statusLine,
    traits: mintSpaceCopy.presets.blessingPuppy.traits,
    axes: { ritual: 0.9, warmth: 0.76, guarding: 0.68, memory: 0.54, mystery: 0.36, motion: 0.22 },
  },
  {
    key: 'earphone_girl',
    match: ['耳机', '声音', '旅行', 'earphone', 'listener', 'story'],
    role: mintSpaceCopy.presets.earphoneGirl.role,
    statusLine: mintSpaceCopy.presets.earphoneGirl.statusLine,
    traits: mintSpaceCopy.presets.earphoneGirl.traits,
    axes: { motion: 0.86, memory: 0.66, warmth: 0.56, mystery: 0.44, ritual: 0.28, guarding: 0.24 },
  },
  {
    key: 'travel_checklist',
    match: ['旅行', '清单', '行李', 'travel', 'checklist', 'luggage'],
    role: mintSpaceCopy.presets.travelChecklist.role,
    statusLine: mintSpaceCopy.presets.travelChecklist.statusLine,
    traits: mintSpaceCopy.presets.travelChecklist.traits,
    axes: { motion: 0.92, memory: 0.48, ritual: 0.42, guarding: 0.32, warmth: 0.28, mystery: 0.24 },
  },
];

const AXIS_KEYWORDS = {
  warmth: ['温柔', '安慰', '陪伴', '祝愿', '朋友', '柔软', 'warm', 'comfort'],
  motion: ['旅行', '远方', '流浪', '风', '探索', '冒险', 'travel', 'journey'],
  mystery: ['神秘', '答案', '梦', '夜', '未知', 'book', 'mystery'],
  guarding: ['守护', '保护', '靠近', '安全', '小狗', 'guard'],
  memory: ['故事', '记忆', '纪念', '声音', '照片', 'story', 'memory'],
  ritual: ['祈福', '祝愿', '仪式', '生日', '晚安', '祝福', 'ritual', 'wish'],
};

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

function safeJson(raw) {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeText(row) {
  return [
    row.name,
    row.code,
    row.description,
    row.story,
    row.personality,
    row.material,
    row.rarity_label,
    row.display_tags_json,
    row.application_code,
    row.application_name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function findPreset(row) {
  const text = normalizeText(row);
  return IP_PRESETS.find(preset => preset.match.some(keyword => text.includes(keyword.toLowerCase()))) || null;
}

function inferKeywordAxes(row) {
  const text = normalizeText(row);
  return Object.fromEntries(Object.keys(BASE_AXES).map((axis) => {
    const keywords = AXIS_KEYWORDS[axis] || [];
    const hits = keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
    return [axis, Math.min(0.82, 0.28 + hits * 0.16)];
  }));
}

function mergeAxes(...axisSets) {
  const result = { ...BASE_AXES };
  axisSets.filter(Boolean).forEach((axes) => {
    Object.keys(BASE_AXES).forEach((key) => {
      if (typeof axes[key] !== 'undefined') {
        result[key] = Math.max(result[key], clamp01(axes[key]));
      }
    });
  });
  return result;
}

function averageAxes(partners) {
  if (partners.length === 0) return { ...BASE_AXES };
  const totals = { ...BASE_AXES };
  Object.keys(totals).forEach((key) => {
    totals[key] = partners.reduce((sum, partner) => sum + clamp01(partner.axes[key]), 0) / partners.length;
  });
  return totals;
}

function parseSpaceProfile(row) {
  const extra = safeJson(row.extra_json);
  return extra.space_profile || extra.mint_space || {};
}

function pickImage(row) {
  if (row.product_image_url || row.cover_url || row.hero_url) {
    return row.product_image_url || row.cover_url || row.hero_url;
  }
  const text = normalizeText(row);
  if (text.includes('纸巾') || text.includes('小狗') || text.includes('puppy')) {
    return '/shop/figures/tissue-puppy.svg';
  }
  if (text.includes('贴纸') || text.includes('sticker')) {
    return '/shop/figures/nfc-sticker.svg';
  }
  return '/shop/figures/designer-toy-default.svg';
}

function buildPartner(row, index) {
  const preset = findPreset(row);
  const profile = parseSpaceProfile(row);
  const axes = mergeAxes(inferKeywordAxes(row), preset?.axes, profile.axes);
  const traits = [
    ...(Array.isArray(preset?.traits) ? preset.traits : []),
    ...(Array.isArray(profile.traits) ? profile.traits : []),
  ].slice(0, 4);

  return {
    id: row.id,
    ipDefinitionId: row.ip_definition_id,
    applicationDefinitionId: row.application_definition_id,
    token: row.token || row.entity_key || '',
    name: row.group_name || row.name || mintSpaceCopy.fallback.unnamedPartner,
    role: profile.role || preset?.role || mintSpaceCopy.fallback.partnerRole,
    statusLine: profile.status_line || profile.statusLine || preset?.statusLine || row.description || mintSpaceCopy.fallback.partnerStatus,
    image: profile.image || pickImage(row),
    applicationCode: row.application_code || '',
    applicationName: row.application_name || '',
    themeColor: row.theme_color || '#34c5d2',
    traits,
    axes,
    collage: {
      x: [18, 74, 34, 62, 48, 84][index % 6],
      y: [48, 44, 26, 24, 54, 32][index % 6],
      scale: index === 0 ? 1 : 0.88,
      orbit: index + 1,
    },
  };
}

function axisEntries(axes) {
  return Object.entries(axes)
    .map(([key, value]) => ({ key, label: mintSpaceCopy.axes[key] || key, value: Number(clamp01(value).toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

function buildAmbience(partners, axes) {
  const palette = [...new Set(partners.map(partner => partner.themeColor).filter(Boolean))].slice(0, 3);
  while (palette.length < 3) {
    palette.push(['#34c5d2', '#f2ae51', '#f7ead2'][palette.length]);
  }

  const dominant = axisEntries(axes)[0]?.key || 'warmth';
  return {
    palette,
    weather: mintSpaceCopy.ambience.weather[dominant] || mintSpaceCopy.ambience.weather.fallback,
    light: axes.mystery > 0.62 ? mintSpaceCopy.ambience.lowLight : axes.warmth > 0.62 ? mintSpaceCopy.ambience.warmLight : mintSpaceCopy.ambience.clearLight,
    terrain: mintSpaceCopy.ambience.terrain[dominant] || mintSpaceCopy.ambience.terrain.fallback,
    dominantAxis: dominant,
  };
}

function buildTraitLabels(axes) {
  return axisEntries(axes).slice(0, 3).map(axis => `${axis.label} ${Math.round(axis.value * 100)}`);
}

function buildPersonalityCode(axes) {
  const letters = {
    warmth: 'W',
    motion: 'M',
    mystery: 'Y',
    guarding: 'G',
    memory: 'R',
    ritual: 'I',
  };
  return axisEntries(axes).slice(0, 4).map(axis => letters[axis.key] || axis.key.slice(0, 1).toUpperCase()).join('');
}

function buildPersonalityDescription(axes) {
  const topAxes = axisEntries(axes).slice(0, 2).map(axis => axis.label).join('与');
  if (!topAxes) return '';
  return mintSpaceCopy.description.personality(topAxes);
}

function buildSpaceDescription(partners, axes) {
  if (partners.length === 0) {
    return mintSpaceCopy.fallback.emptyDescription;
  }

  const names = partners.slice(0, 3).map(partner => partner.name).join('、');
  return mintSpaceCopy.description.active({
    names,
    hasMore: partners.length > 3,
    personality: buildPersonalityDescription(axes),
  });
}

function relationNoteForPair(a, b) {
  const pair = `${a.name}|${b.name}`;
  if (pair.includes('纸巾') && pair.includes('答案')) {
    return mintSpaceCopy.notes.tissueAnswer;
  }
  if (pair.includes('纸巾') && pair.includes('耳机')) {
    return mintSpaceCopy.notes.tissueEarphone;
  }
  if (pair.includes('祈福') && pair.includes('答案')) {
    return mintSpaceCopy.notes.blessingAnswer;
  }
  return '';
}

function fetchRelationNotes(db, ipDefinitionIds) {
  if (ipDefinitionIds.length < 2) return [];
  const placeholders = ipDefinitionIds.map(() => '?').join(',');
  return resultToObjects(db.exec(
    `SELECT r.id, r.narrative, r.relation_label,
            s.name as source_name, t.name as target_name
     FROM ip_definition_relation_links r
     LEFT JOIN ip_definitions s ON s.id = r.source_ip_definition_id
     LEFT JOIN ip_definitions t ON t.id = r.target_ip_definition_id
     WHERE r.status = 'active'
       AND r.source_ip_definition_id IN (${placeholders})
       AND r.target_ip_definition_id IN (${placeholders})
     ORDER BY r.sort_order ASC, r.created_at DESC
     LIMIT 4`,
    [...ipDefinitionIds, ...ipDefinitionIds]
  )).map((row, index) => ({
    id: `relation-${row.id || index}`,
    text: row.narrative || mintSpaceCopy.notes.relation({
      sourceName: row.source_name || mintSpaceCopy.fallback.missingRelation,
      targetName: row.target_name || mintSpaceCopy.fallback.anotherRelation,
      relationLabel: row.relation_label || mintSpaceCopy.fallback.relationLabel,
    }),
    source: 'relation_matrix',
  }));
}

function buildNotes(db, partners, axes) {
  if (partners.length === 0) {
    return [
      { id: 'empty', text: mintSpaceCopy.fallback.emptyNote, source: 'space_state' },
    ];
  }

  const notes = [
    {
      id: 'count',
      text: mintSpaceCopy.notes.count(partners.length),
      source: 'space_state',
    },
  ];

  const relationNotes = fetchRelationNotes(db, [...new Set(partners.map(partner => partner.ipDefinitionId).filter(Boolean))]);
  notes.push(...relationNotes);

  for (let i = 0; i < partners.length; i += 1) {
    for (let j = i + 1; j < partners.length; j += 1) {
      const text = relationNoteForPair(partners[i], partners[j]);
      if (text) notes.push({ id: `pair-${partners[i].id}-${partners[j].id}`, text, source: 'rule_relation' });
    }
  }

  if (notes.length < 3) {
    const topAxis = axisEntries(axes)[0];
    notes.push({
      id: 'ambience',
      text: mintSpaceCopy.notes.ambience(topAxis.label),
      source: 'space_profile',
    });
  }

  return notes.slice(0, 5);
}

function listMintSpaceRows(db, userId) {
  return resultToObjects(db.exec(
    `SELECT e.id, e.ip_definition_id, e.application_definition_id, e.label, e.token, e.entity_key,
            e.instance_type, e.status, e.bound_at, e.created_at,
            d.code, d.name as group_name, d.primary_series_key as series_id, d.primary_series_name as series_name,
            d.cover_url, d.hero_url, d.product_image_url, d.description, d.story, d.personality,
            d.material, d.rarity_label, d.display_tags_json, d.theme_color, d.extra_json,
            a.code as application_code, a.name as application_name
     FROM ip_instances e
     LEFT JOIN ip_definitions d ON e.ip_definition_id = d.id
     LEFT JOIN application_definitions a ON a.id = e.application_definition_id
     WHERE e.owner_user_id = ?
       AND COALESCE(e.instance_type, 'physical') != 'official_demo'
     ORDER BY e.bound_at DESC, e.created_at DESC`,
    [userId]
  ));
}

export function buildMintSpaceProfile(db, userId) {
  const rows = listMintSpaceRows(db, userId);
  const partners = rows.map(buildPartner);
  const axes = averageAxes(partners);
  const ambience = buildAmbience(partners, axes);

  return {
    profile: {
      title: mintSpaceCopy.fallback.title,
      subtitle: partners.length > 0 ? mintSpaceCopy.fallback.activeSubtitle : mintSpaceCopy.fallback.emptySubtitle,
      summary: partners.length > 0
        ? mintSpaceCopy.fallback.activeSummary(partners.length)
        : mintSpaceCopy.fallback.emptySummary,
      description: buildSpaceDescription(partners, axes),
      personalityCode: buildPersonalityCode(axes),
      partnerCount: partners.length,
      axes: axisEntries(axes),
      traitLabels: buildTraitLabels(axes),
      ambience,
    },
    partners,
    notes: buildNotes(db, partners, axes),
    emptyState: {
      title: mintSpaceCopy.fallback.emptyStateTitle,
      body: mintSpaceCopy.fallback.emptyStateBody,
    },
  };
}
