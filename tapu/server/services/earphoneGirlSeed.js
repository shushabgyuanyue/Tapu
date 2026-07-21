import { stringifyJson } from './coreStore.js';
import { resultToObjects } from './tokens.js';
import {
  CONTENT_DEFINITIONS,
  CROSSOVER_CONTENTS,
  MEMORY_CONTENTS,
  STORY_CONTENTS,
} from './earphoneGirlSeedData.js';

export const EARPHONE_GIRL_APP_CODE = 'earphone-girl';
export const EARPHONE_GIRL_DEMO_TOKEN = 'earphone-girl-demo-token';

const APP_ID = 'earphone-girl';
const IP_ID = 'ipdef_earphone_girl';
const INSTANCE_ID = 'ipinst_earphone_girl_demo';

function contentWasDeleted(db, contentId) {
  try {
    return resultToObjects(db.exec(
      'SELECT content_instance_id FROM content_instance_deletions WHERE content_instance_id = ? LIMIT 1',
      [contentId]
    )).length > 0;
  } catch {
    return false;
  }
}

function upsertApplicationDefinition(db) {
  db.run(
    `INSERT INTO application_definitions
     (id, code, name, version_no, app_type, interaction_type, description,
      object_principle, behavior, meaning_question, experience_flow_json,
      skill_config_json, content_template_json, event_subscription_json,
      key_action_schema_json, route_config_json, permission_policy_json, extra_json, status)
     VALUES (?, ?, ?, '1.0.0', 'meaning', 'audio_story_gateway', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
     ON CONFLICT(code) DO UPDATE SET
       name = excluded.name,
       version_no = excluded.version_no,
       app_type = excluded.app_type,
       interaction_type = excluded.interaction_type,
       description = excluded.description,
       object_principle = excluded.object_principle,
       behavior = excluded.behavior,
       meaning_question = excluded.meaning_question,
       experience_flow_json = excluded.experience_flow_json,
       skill_config_json = excluded.skill_config_json,
       content_template_json = excluded.content_template_json,
       event_subscription_json = excluded.event_subscription_json,
       key_action_schema_json = excluded.key_action_schema_json,
       route_config_json = excluded.route_config_json,
       permission_policy_json = excluded.permission_policy_json,
       extra_json = excluded.extra_json,
       status = excluded.status,
       updated_at = CURRENT_TIMESTAMP`,
    [
      APP_ID,
      EARPHONE_GIRL_APP_CODE,
      '耳机小姐',
      '一个以声音、插画和轻入口承载的故事空间。',
      '一枚耳机贴纸打开一个会旅行、会倾听、会带回故事的朋友。',
      'touch_to_listen_then_follow_story',
      '今天我会从她这里听见谁的故事？',
      stringifyJson({
        cadence: { mode: 'instance_sequence_with_window', defaultHours: 12 },
        progression: {
          scope: 'ip_instance',
          policy: 'consume_next_in_order',
          advanceOn: 'story.play_completed',
          crossoverIsSecondaryTrack: true,
        },
      }),
      stringifyJson({
        engineMode: 'fixed_rules_v1',
        skills: [
          { key: 'scheduled_story_broadcast', trigger: { type: 'time_window_refresh' } },
          { key: 'repeat_touch_crossover_invite', trigger: { type: 'repeat_touch_same_window' } },
        ],
      }),
      stringifyJson({
        primaryTemplates: CONTENT_DEFINITIONS.map(item => item.code),
        storyQueue: {
          orderingMode: 'manual_sort_order',
          progressStateKey: 'story.sequence_progress',
        },
      }),
      stringifyJson({
        subscriptions: [
          { eventType: 'emotion.frequent_touch', scope: 'related_ip_only', role: 'listener' },
        ],
      }),
      stringifyJson({
        operations: [
          { key: 'object.touch', recordAs: 'operation' },
          { key: 'story.play_completed', recordAs: 'operation' },
        ],
      }),
      stringifyJson({
        openRoute: '/earphone-girl',
        studioRoute: '/mint',
        adminRoute: '/official/applications',
      }),
      stringifyJson({
        read: 'public',
        createContent: 'login_required',
        bindByToken: 'token_unbound_or_owner',
        setOfficialDefaultContent: 'admin_required',
      }),
      stringifyJson({
        voiceDirection: ['有灵气', '成熟克制', '分享遇见而不是推销'],
        visualDirection: ['手账感', '生活插画', '声音可视化'],
      }),
    ]
  );
}

function upsertIpDefinition(db) {
  db.run(
    `INSERT INTO ip_definitions
     (id, code, name, creator_user_id, primary_series_key, primary_series_name,
      description, story, personality, designer, material, size_label, rarity_label,
      nfc_type, cover_url, hero_url, product_image_url, display_tags_json, theme_color, physical_spec_json,
      extra_json, status)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
     ON CONFLICT(id) DO UPDATE SET
       code = excluded.code,
       name = excluded.name,
       primary_series_key = excluded.primary_series_key,
       primary_series_name = excluded.primary_series_name,
       description = excluded.description,
       story = excluded.story,
       personality = excluded.personality,
       designer = excluded.designer,
       material = excluded.material,
       size_label = excluded.size_label,
       rarity_label = excluded.rarity_label,
       nfc_type = excluded.nfc_type,
       cover_url = excluded.cover_url,
       hero_url = excluded.hero_url,
       product_image_url = excluded.product_image_url,
       display_tags_json = excluded.display_tags_json,
       theme_color = excluded.theme_color,
       physical_spec_json = excluded.physical_spec_json,
       extra_json = excluded.extra_json,
       status = excluded.status,
       updated_at = CURRENT_TIMESTAMP`,
    [
      IP_ID,
      'earphone-girl',
      '耳机小姐',
      'whatmint-core-friends',
      'WhatMint 核心朋友',
      '喜欢旅行、倾听和讲故事的耳机伙伴。',
      '耳机小姐住在你的耳机里。她会去不同空间旅行，听见每个 IP 没有说完的话，再把那些温柔的小故事带回来讲给你听。',
      '冒险家；倾听者；朋友；成熟克制；有灵气。',
      'WhatMint Official',
      'NFC 贴纸 / 耳机贴纸',
      '轻量贴纸',
      '官方核心 IP',
      'sticker_nfc',
      '/earphone-girl/cover.svg',
      '/earphone-girl/hero.svg',
      '/earphone-girl/product.svg',
      stringifyJson(['官方核心IP', '故事空间', '声音陪伴', '关系联动']),
      '#2f7d7a',
      stringifyJson({
        coreObject: '耳机贴纸',
        primaryMedia: ['audio', 'illustration'],
        coreActions: ['listen', 'tell_story', 'share'],
      }),
      stringifyJson({
        ipType: 'official_core_ip',
        appPosition: 'story_space_and_ip_gateway',
        toneKeywords: ['有灵气', '成熟克制', '歌颂美好', '兼具商业性'],
      }),
    ]
  );
}

function upsertContentDefinitions(db) {
  for (const definition of CONTENT_DEFINITIONS) {
    db.run(
      `INSERT INTO content_definitions
       (id, code, name, description, content_kind, primary_modality, authoring_schema_json, template_json, extra_json, status)
       VALUES (?, ?, ?, ?, 'mixed', 'mixed', ?, ?, ?, 'active')
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         content_kind = excluded.content_kind,
         primary_modality = excluded.primary_modality,
         authoring_schema_json = excluded.authoring_schema_json,
         template_json = excluded.template_json,
         extra_json = excluded.extra_json,
         status = excluded.status,
         updated_at = CURRENT_TIMESTAMP`,
      [
        definition.id,
        definition.code,
        definition.name,
        definition.description,
        stringifyJson(definition.authoringSchema),
        stringifyJson(definition.template),
        stringifyJson(definition.extra),
      ]
    );
  }
}

function upsertLinks(db) {
  db.run(
    `INSERT INTO ip_definition_application_links
     (id, ip_definition_id, application_definition_id, relation_role, is_primary, sort_order, metadata_json)
     VALUES (?, ?, ?, 'primary', 1, 0, ?)
     ON CONFLICT(ip_definition_id, application_definition_id, relation_role) DO UPDATE SET
       is_primary = excluded.is_primary,
       sort_order = excluded.sort_order,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    ['ipalink_earphone_girl_primary', IP_ID, APP_ID, stringifyJson({ shopEntry: true, storyEntry: true })]
  );

  for (const definition of CONTENT_DEFINITIONS) {
    db.run(
      `INSERT INTO application_content_definition_links
       (id, application_definition_id, content_definition_id, relation_role, is_primary, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(application_definition_id, content_definition_id, relation_role) DO UPDATE SET
         is_primary = excluded.is_primary,
         sort_order = excluded.sort_order,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `aclink_${EARPHONE_GIRL_APP_CODE}_${definition.code}`,
        APP_ID,
        definition.id,
        definition.relationRole,
        definition.isPrimary,
        Number.isFinite(Number(definition.sortOrder)) ? Number(definition.sortOrder) : (definition.isPrimary ? 0 : 10),
      ]
    );
  }
}

function upsertInstance(db) {
  db.run(
    `INSERT INTO ip_instances
     (id, ip_definition_id, owner_user_id, application_definition_id, label, token, entity_key,
      instance_type, source_type, status, visibility, metadata_json)
     VALUES (?, ?, NULL, ?, ?, ?, ?, 'official_demo', 'official', 'active', 'public', ?)
     ON CONFLICT(id) DO UPDATE SET
       ip_definition_id = excluded.ip_definition_id,
       application_definition_id = excluded.application_definition_id,
       label = excluded.label,
       token = excluded.token,
       entity_key = excluded.entity_key,
       instance_type = excluded.instance_type,
       source_type = excluded.source_type,
       status = excluded.status,
       visibility = excluded.visibility,
       metadata_json = excluded.metadata_json,
       updated_at = CURRENT_TIMESTAMP`,
    [
      INSTANCE_ID,
      IP_ID,
      APP_ID,
      '耳机小姐官方体验',
      EARPHONE_GIRL_DEMO_TOKEN,
      EARPHONE_GIRL_DEMO_TOKEN,
      stringifyJson({ official: true, queueKey: 'official-main-sequence' }),
    ]
  );
}

function upsertResource(db, content, relationRole = 'story_visual') {
  const id = `${content.id}_visual`;
  db.run(
    `INSERT INTO resources
     (id, owner_user_id, resource_type, mime_type, original_filename, storage_provider,
      storage_key, storage_url, preview_url, status, metadata_json)
     VALUES (?, NULL, 'image', 'image/svg+xml', ?, 'local', ?, ?, ?, 'ready', ?)
     ON CONFLICT(id) DO UPDATE SET
       storage_url = excluded.storage_url,
       preview_url = excluded.preview_url,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      content.visual.split('/').pop(),
      content.visual,
      content.visual,
      content.visual,
      stringifyJson({ source: 'earphone-girl-seed', relationRole }),
    ]
  );
  return id;
}

function upsertStoryContents(db) {
  for (const story of STORY_CONTENTS) {
    if (contentWasDeleted(db, story.id)) continue;
    const resourceId = upsertResource(db, story, 'story_visual');
    db.run(
      `INSERT INTO content_instances
       (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id,
        creator_user_id, origin_ip_instance_id, title, summary, content_kind, primary_modality,
        source_type, visibility, access_scope, status, version_no, payload_json, published_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'mixed', 'mixed', 'official', 'public', 'public',
        'published', 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         ip_definition_id = excluded.ip_definition_id,
         content_definition_id = excluded.content_definition_id,
         application_definition_id = excluded.application_definition_id,
         origin_ip_instance_id = excluded.origin_ip_instance_id,
         title = excluded.title,
         summary = excluded.summary,
         content_kind = excluded.content_kind,
         primary_modality = excluded.primary_modality,
         source_type = excluded.source_type,
         visibility = excluded.visibility,
         access_scope = excluded.access_scope,
         status = excluded.status,
         payload_json = excluded.payload_json,
         published_at = COALESCE(content_instances.published_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [
        story.id,
        IP_ID,
        'cntdef_earphone_girl_periodic_story',
        APP_ID,
        INSTANCE_ID,
        story.title,
        story.summary,
        stringifyJson(story.payload),
      ]
    );

    db.run(
      `INSERT INTO ip_instance_content_instance_links
       (id, ip_instance_id, content_instance_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, 'story_sequence', ?, ?, ?)
       ON CONFLICT(ip_instance_id, content_instance_id, relation_role) DO UPDATE SET
         is_primary = excluded.is_primary,
         sort_order = excluded.sort_order,
         metadata_json = excluded.metadata_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `iiclink_${INSTANCE_ID}_${story.id}`,
        INSTANCE_ID,
        story.id,
        story.payload.sequenceOrder === 1 ? 1 : 0,
        story.payload.sequenceOrder,
        stringifyJson({ queueKey: 'official-main-sequence' }),
      ]
    );

    db.run(
      `INSERT INTO content_instance_resource_links
       (id, content_instance_id, resource_id, relation_role, is_primary, sort_order)
       VALUES (?, ?, ?, 'story_visual', 1, 0)
       ON CONFLICT(content_instance_id, resource_id, relation_role) DO UPDATE SET
         is_primary = excluded.is_primary,
         sort_order = excluded.sort_order,
         updated_at = CURRENT_TIMESTAMP`,
      [`cirlink_${story.id}_${resourceId}`, story.id, resourceId]
    );
  }
}

function upsertSupportingContent(db, contentItems) {
  for (const item of contentItems) {
    if (contentWasDeleted(db, item.id)) continue;
    const resourceId = upsertResource(db, item, item.resourceRole);
    db.run(
      `INSERT INTO content_instances
       (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id,
        creator_user_id, origin_ip_instance_id, title, summary, content_kind, primary_modality,
        source_type, visibility, access_scope, status, version_no, payload_json, published_at)
       VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, 'mixed', 'mixed', 'official', 'public', 'public',
        'published', 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         ip_definition_id = excluded.ip_definition_id,
         content_definition_id = excluded.content_definition_id,
         application_definition_id = excluded.application_definition_id,
         origin_ip_instance_id = excluded.origin_ip_instance_id,
         title = excluded.title,
         summary = excluded.summary,
         content_kind = excluded.content_kind,
         primary_modality = excluded.primary_modality,
         source_type = excluded.source_type,
         visibility = excluded.visibility,
         access_scope = excluded.access_scope,
         status = excluded.status,
         payload_json = excluded.payload_json,
         published_at = COALESCE(content_instances.published_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP`,
      [
        item.id,
        IP_ID,
        item.definitionId,
        APP_ID,
        INSTANCE_ID,
        item.title,
        item.summary,
        stringifyJson(item.payload),
      ]
    );

    db.run(
      `INSERT INTO ip_instance_content_instance_links
       (id, ip_instance_id, content_instance_id, relation_role, is_primary, sort_order, metadata_json)
       VALUES (?, ?, ?, ?, 0, 0, ?)
       ON CONFLICT(ip_instance_id, content_instance_id, relation_role) DO UPDATE SET
         metadata_json = excluded.metadata_json,
         updated_at = CURRENT_TIMESTAMP`,
      [
        `iiclink_${INSTANCE_ID}_${item.id}`,
        INSTANCE_ID,
        item.id,
        item.relationRole,
        stringifyJson({ placeholder: true, source: 'official_seed' }),
      ]
    );

    db.run(
      `INSERT INTO content_instance_resource_links
       (id, content_instance_id, resource_id, relation_role, is_primary, sort_order)
       VALUES (?, ?, ?, ?, 1, 0)
       ON CONFLICT(content_instance_id, resource_id, relation_role) DO UPDATE SET
         is_primary = excluded.is_primary,
         sort_order = excluded.sort_order,
         updated_at = CURRENT_TIMESTAMP`,
      [`cirlink_${item.id}_${resourceId}`, item.id, resourceId, item.resourceRole]
    );
  }
}

export function ensureEarphoneGirlSeed(db) {
  upsertApplicationDefinition(db);
  upsertIpDefinition(db);
  upsertContentDefinitions(db);
  upsertLinks(db);
  upsertInstance(db);
  upsertStoryContents(db);
  upsertSupportingContent(db, CROSSOVER_CONTENTS);
  upsertSupportingContent(db, MEMORY_CONTENTS);
}
