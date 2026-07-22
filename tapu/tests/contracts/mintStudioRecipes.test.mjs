import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { findAppManifest, getAppManifests } from '../../server/contracts/appManifests.js';
import { resolveDefaultContentForIpInstance } from '../../server/routes/contents.js';
import { upsertIpInstanceContentLink } from '../../server/services/coreStore.js';
import { setAssetInstanceDefaultContent } from '../../server/services/assetSpace.js';
import { getRegisteredAppAdapters } from '../../server/services/appAdapters.js';
import {
  getMintStudioOpenPath,
  getMintStudioProfile,
  getMintStudioProfileDiagnostics,
} from '../../server/services/mintStudioRecipeCatalog.js';
import { buildDefinitionDrivenStudioFlow } from '../../server/services/mintStudioContentGuides.js';
import {
  buildContentPreviewRoute,
  inferContentRenderer,
} from '../../server/services/contentRenderingProtocol.js';
import { buildOsEntryPrompt } from '../../server/services/osEntryPrompt.js';
import {
  buildContentAuthoringRecipe,
  createContentVersionDraft,
  publishContentVersion,
} from '../../server/services/contentVersions.js';
import {
  assertContentResourcesMatchDefinition,
  buildContentBlocksFromNodes,
  buildContentResourceNodes,
  getContentDefinitionBindingConfig,
  hydrateAuthoringResources,
} from '../../server/services/contentResourceBinding.js';
import { ensureApplicationRegistry } from '../../server/services/applicationRegistry.js';
import { buildCoreContentLibraryItems } from '../../server/services/mintStudioLibrary.js';
import {
  getApplicationLifecycleFromRow,
  getManifestLifecycle,
  isApplicationRowSurfaceEnabled,
} from '../../server/services/applicationLifecycle.js';
import { ensureCoreOfficialIpSeed } from '../../server/services/coreOfficialIpSeed.js';
import { listShopIpDefinitions } from '../../server/services/shopCatalog.js';
import { backfillCoreTables } from '../../server/db/coreBackfill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runSqlFile(db, relativePath) {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf-8');
  for (const statement of sql.split(';').map(item => item.trim()).filter(Boolean)) {
    db.run(`${statement};`);
  }
}

async function createMintStudioLibraryDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(`CREATE TABLE content_instances (
    id TEXT PRIMARY KEY,
    ip_definition_id TEXT,
    content_definition_id TEXT,
    application_definition_id TEXT,
    owner_user_id TEXT,
    creator_user_id TEXT,
    origin_ip_instance_id TEXT,
    title TEXT,
    summary TEXT,
    content_kind TEXT,
    primary_modality TEXT,
    source_type TEXT,
    visibility TEXT,
    access_scope TEXT,
    status TEXT,
    version_no INTEGER DEFAULT 1,
    payload_json TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE TABLE content_definitions (id TEXT PRIMARY KEY, code TEXT, name TEXT, content_kind TEXT, primary_modality TEXT, authoring_schema_json TEXT, template_json TEXT)');
  db.run('CREATE TABLE ip_definitions (id TEXT PRIMARY KEY, name TEXT, primary_series_name TEXT)');
  db.run('CREATE TABLE application_definitions (id TEXT PRIMARY KEY, code TEXT, name TEXT, status TEXT DEFAULT "active", extra_json TEXT)');
  db.run('CREATE TABLE ip_instances (id TEXT PRIMARY KEY, ip_definition_id TEXT, application_definition_id TEXT, owner_user_id TEXT, token TEXT, entity_key TEXT, instance_type TEXT, label TEXT, status TEXT)');
  db.run(`CREATE TABLE content_instance_resource_links (
    id TEXT,
    content_instance_id TEXT,
    resource_id TEXT,
    is_primary INTEGER,
    relation_role TEXT,
    sort_order INTEGER,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE ip_instance_content_instance_links (
    id TEXT PRIMARY KEY,
    ip_instance_id TEXT,
    content_instance_id TEXT,
    relation_role TEXT,
    is_primary INTEGER,
    sort_order INTEGER,
    starts_at TEXT,
    ends_at TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ip_instance_id, content_instance_id, relation_role)
  )`);
  db.run(`CREATE TABLE resources (
    id TEXT PRIMARY KEY,
    owner_user_id TEXT,
    resource_type TEXT,
    mime_type TEXT,
    original_filename TEXT,
    storage_url TEXT,
    preview_url TEXT,
    duration REAL,
    width INTEGER,
    height INTEGER,
    status TEXT,
    metadata_json TEXT
  )`);
  db.run(`CREATE TABLE content_instance_versions (
    id TEXT PRIMARY KEY,
    content_instance_id TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    mode TEXT DEFAULT 'revise',
    status TEXT DEFAULT 'draft',
    base_version_id TEXT,
    title TEXT,
    summary TEXT,
    payload_json TEXT,
    resource_snapshot_json TEXT,
    change_summary TEXT,
    created_by TEXT,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(content_instance_id, version_no)
  )`);
  db.run(`CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_type TEXT,
    dedupe_key TEXT,
    actor_user_id TEXT,
    user_id TEXT,
    ip_definition_id TEXT,
    application_definition_id TEXT,
    content_definition_id TEXT,
    ip_instance_id TEXT,
    content_instance_id TEXT,
    resource_id TEXT,
    source_operation_id TEXT,
    source_event_id TEXT,
    payload_json TEXT,
    context_snapshot_json TEXT,
    processing_status TEXT DEFAULT 'pending',
    processing_attempts INTEGER DEFAULT 0,
    processed_at DATETIME,
    occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`INSERT INTO content_definitions
    (id, code, name, content_kind, primary_modality, authoring_schema_json, template_json)
    VALUES (
      'cntdef-puppy',
      'tissue-puppy-comfort-ar',
      '纸巾小狗 AR 召唤',
      'ar',
      'video',
      '{"authoringProtocol":{"createFlow":"single_resource_node","unitLabel":"AR 召唤节点"},"contentShape":{"unit":"comfort_ar_node","slots":[{"key":"comfort_ar_overlay","role":"ar_overlay","type":"video","label":"AR 召唤视频","required":true}]}}',
      '{"renderer":"ar.camera-overlay","layout":"marker_anchor_overlay","playback":{"autoplay":true,"mutedByDefault":true},"ar":{"mode":"marker_overlay","engine":"mindar-image-tracking","placement":"marker_anchor","tracking":"marker_image","markerImageUrl":"/ar-placeholders/tissue-puppy-marker.png"}}'
    )`);
  db.run("INSERT INTO ip_definitions (id, name, primary_series_name) VALUES ('ip-puppy', '纸巾小狗', '永远系列')");
  db.run("INSERT INTO application_definitions (id, code, name, status, extra_json) VALUES ('app-puppy', 'tissue-puppy', '纸巾小狗', 'active', '{\"lifecycle\":{\"status\":\"active\",\"surfaces\":{\"shop\":true,\"nfc\":true,\"studio\":true,\"admin\":true}}}')");
  db.run("INSERT INTO ip_instances (id, ip_definition_id, application_definition_id, owner_user_id, token, entity_key, instance_type, label, status) VALUES ('ipinst-puppy', 'ip-puppy', 'app-puppy', 'user-1', 'token-1', 'token-1', 'mint_entity', '纸巾小狗', 'active')");
  db.run("INSERT INTO resources (id, owner_user_id, resource_type, storage_url, preview_url, status) VALUES ('res-puppy', 'user-1', 'video', '/video.mp4', '/poster.jpg', 'ready')");
  db.run("INSERT INTO resources (id, owner_user_id, resource_type, storage_url, preview_url, status) VALUES ('res-puppy-new', 'user-1', 'video', '/new-video.mp4', '/new-poster.jpg', 'ready')");
  db.run("INSERT INTO content_instance_resource_links (content_instance_id, resource_id, is_primary, relation_role) VALUES ('content-puppy', 'res-puppy', 1, 'ar_overlay')");
  db.run(`INSERT INTO content_instances
    (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
     origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
     status, payload_json, created_at, updated_at)
    VALUES
    ('content-puppy', 'ip-puppy', 'cntdef-puppy', 'app-puppy', 'user-1', 'user-1',
     'ipinst-puppy', '纸巾小狗 · AR 召唤', '一个 AR 内容节点', 'ar', 'video', 'user', 'private', 'owner',
     'published', '{"source":"mint-studio-definition-authoring","renderer":"video.fullscreen"}', '2026-07-20', '2026-07-20'),
    ('content-legacy', 'ip-puppy', 'cntdef-puppy', 'app-puppy', 'user-1', 'user-1',
     'ipinst-puppy', '旧合集配置', '不应进入创作中心内容列表', 'mixed', 'mixed', 'official', 'public', 'public',
     'published', '{"source":"legacy-official-cms"}', '2026-07-20', '2026-07-20')`);
  db.run(`INSERT INTO ip_instance_content_instance_links
    (id, ip_instance_id, content_instance_id, relation_role, is_primary, sort_order, metadata_json)
    VALUES ('link-puppy-owner-default', 'ipinst-puppy', 'content-puppy', 'owner_default', 1, 0, '{}')`);
  return db;
}

async function createCoreSeedDb() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  runSqlFile(db, 'server/db/core-schema.sql');
  ensureApplicationRegistry(db);
  backfillCoreTables(db);
  ensureCoreOfficialIpSeed(db);
  return db;
}

test('mint studio profiles exist for light app manifests that need UI recipes', () => {
  const adapters = getRegisteredAppAdapters();
  for (const adapter of adapters) {
    const profileCode = adapter.manifest?.mintStudio?.profile;
    if (!profileCode || profileCode === 'entity-recipe') continue;
    assert.ok(
      getMintStudioProfile(adapter.appCode),
      `${adapter.appCode} declares Mint Studio profile ${profileCode} but has no UI recipe profile`
    );
  }
});

test('mint studio open routes follow app manifest defaults', () => {
  for (const adapter of getRegisteredAppAdapters()) {
    const expectedOpenPath = adapter.manifest?.defaultRoutes?.open;
    if (!expectedOpenPath) continue;
    assert.equal(getMintStudioOpenPath(adapter.appCode), expectedOpenPath);
  }
});

test('mint studio recipe diagnostics expose every adapter', () => {
  const diagnostics = getMintStudioProfileDiagnostics();
  const diagnosticCodes = new Set(diagnostics.map(item => item.appCode));
  for (const adapter of getRegisteredAppAdapters()) {
    assert.ok(diagnosticCodes.has(adapter.appCode), `${adapter.appCode} missing from Studio diagnostics`);
  }
});

test('tissue puppy enters Mint Studio through a single AR content definition', () => {
  const manifest = findAppManifest('tissue-puppy');
  const profile = getMintStudioProfile('tissue-puppy');

  assert.ok(manifest, 'tissue-puppy manifest should exist');
  assert.ok(profile, 'tissue-puppy Studio profile should exist');
  assert.equal(manifest.contentDefinition?.code, 'tissue-puppy-comfort-ar');
  assert.equal(manifest.contentDefinition?.authoringSchema?.authoringProtocol?.createFlow, 'single_resource_node');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.type, 'video');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.resourceProfile, 'ar_alpha_overlay');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.requiresAlpha, true);
  assert.equal(manifest.contentDefinition?.template?.renderer, 'ar.camera-overlay');
  assert.equal(manifest.contentDefinition?.template?.ar?.engine, 'mindar-image-tracking');
  assert.equal(manifest.contentDefinition?.template?.ar?.placement, 'marker_anchor');
  assert.equal(manifest.contentDefinition?.template?.ar?.tracking, 'marker_image');
  assert.equal(manifest.contentDefinition?.template?.ar?.markerImageUrl, '/ar-placeholders/tissue-puppy-marker.png');
  assert.equal(manifest.contentDefinition?.template?.playback?.mutedByDefault, true);
  assert.equal(manifest.contentDefinition?.template?.playback?.tapToUnmute, true);
  assert.equal(manifest.contentDefinition?.template?.playback?.replayMode, 'loop');
  assert.ok(profile.creationModes.some(mode => mode.code === 'claim_entity'));
  assert.ok(!profile.creationModes.some(mode => mode.code === 'collect_asset'));
});

test('desktop secret enters Mint Studio through the OS AR image renderer definition', () => {
  const manifest = findAppManifest('desktop-secret');
  const profile = getMintStudioProfile('desktop-secret');

  assert.ok(manifest, 'desktop-secret manifest should exist');
  assert.ok(profile, 'desktop-secret Studio profile should exist');
  assert.equal(manifest.contentDefinition?.code, 'desktop-secret-ar-realm');
  assert.equal(manifest.contentDefinition?.contentKind, 'ar');
  assert.equal(manifest.contentDefinition?.primaryModality, 'image');
  assert.equal(manifest.contentDefinition?.authoringSchema?.authoringProtocol?.createFlow, 'single_resource_node');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.type, 'image');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.role, 'ar_overlay');
  assert.equal(manifest.contentDefinition?.authoringSchema?.contentShape?.slots?.[0]?.resourceProfile, 'ar_image_overlay');
  assert.equal(manifest.contentDefinition?.template?.renderer, 'ar.camera-overlay');
  assert.equal(manifest.contentDefinition?.template?.ar?.engine, 'mindar-image-tracking');
  assert.equal(manifest.contentDefinition?.template?.ar?.placement, 'marker_anchor');
  assert.equal(manifest.contentDefinition?.template?.ar?.tracking, 'marker_image');
  assert.equal(manifest.contentDefinition?.template?.ar?.markerImageUrl, '/ar-placeholders/desktop-secret-marker.png');
  assert.equal(manifest.contentDefinition?.template?.ar?.shadow, true);
  assert.equal(manifest.contentDefinition?.template?.ar?.perspective, true);
  assert.ok(profile.creationModes.some(mode => mode.code === 'claim_entity'));
  assert.ok(!manifest.mintStudio?.primaryActions?.includes('collect_asset'));
  assert.ok(!profile.creationModes.some(mode => mode.code === 'collect_asset'));
});

test('shop catalog contains the active new-core public IP entries after seed', async () => {
  const db = await createCoreSeedDb();
  db.run("INSERT INTO application_definitions (id, code, name, interaction_type, status) VALUES ('app-legacy-moment', 'moment', '纪念瞬间', 'tap_to_moment', 'active')");
  db.run("INSERT INTO ip_definitions (id, code, name, status) VALUES ('ipdef-legacy-moment', 'moment', '纪念瞬间', 'active')");
  db.run("INSERT INTO ip_definition_application_links (id, ip_definition_id, application_definition_id, relation_role, is_primary) VALUES ('link-legacy-moment', 'ipdef-legacy-moment', 'app-legacy-moment', 'primary', 1)");
  const items = listShopIpDefinitions(db);
  const byCode = new Map(items.map(item => [item.code, item]));

  for (const code of ['tissue-puppy', 'desktop-secret']) {
    assert.ok(byCode.has(code), `${code} should be visible in shop catalog`);
  }
  assert.equal(byCode.has('moment'), false, 'legacy non-manifest IP should not be visible in shop catalog');
  assert.equal(byCode.get('tissue-puppy')?.name, '纸巾小狗');
  assert.equal(byCode.get('tissue-puppy')?.application_code, 'tissue-puppy');
  assert.equal(byCode.get('tissue-puppy')?.official_experiences?.[0]?.id, 'content-tissue-puppy-ar-placeholder');
  assert.equal(byCode.get('desktop-secret')?.official_experiences?.[0]?.id, 'content-desktop-secret-ar-snow-realm');
});

test('no active app manifest uses legacy collect_asset actions', () => {
  for (const manifest of getAppManifests()) {
    const hasLegacyAction = manifest.mintStudio?.primaryActions?.includes('collect_asset');
    assert.equal(hasLegacyAction, false);
  }
});

test('application lifecycle controls customer-facing surfaces', async () => {
  const db = await createCoreSeedDb();
  const manifests = new Map(getAppManifests().map(manifest => [manifest.code, manifest]));

  assert.equal(getManifestLifecycle(manifests.get('tissue-puppy')).status, 'active');
  assert.equal(getManifestLifecycle(manifests.get('tissue-puppy')).surfaces.shop, true);
  assert.equal(getManifestLifecycle(manifests.get('desktop-secret')).surfaces.nfc, true);
  for (const retiredCode of ['emotion-ip', 'earphone-girl', 'answer-book', 'moment', 'travel-trail', 'check']) {
    assert.equal(manifests.has(retiredCode), false, `${retiredCode} should not remain as a manifest`);
  }

  const rows = db.exec(
    `SELECT code, version_no, status, extra_json
     FROM application_definitions
     WHERE code IN ('tissue-puppy', 'emotion-ip', 'earphone-girl', 'answer-book', 'moment', 'travel-trail', 'check')
     ORDER BY code`
  )[0].values.map(([code, version_no, status, extra_json]) => ({ code, version_no, status, extra_json }));
  const byCode = new Map(rows.map(row => [row.code, row]));

  assert.equal(getApplicationLifecycleFromRow(byCode.get('tissue-puppy')).status, 'active');
  assert.equal(isApplicationRowSurfaceEnabled(byCode.get('tissue-puppy'), 'shop'), true);
  for (const retiredCode of ['emotion-ip', 'earphone-girl', 'answer-book', 'moment', 'travel-trail', 'check']) {
    assert.equal(byCode.has(retiredCode), false, `${retiredCode} should not be seeded into application_definitions`);
  }
});

test('definition-driven Studio flow can switch publish actions by permission subject', () => {
  const guides = [{
    id: 'content-def-tissue-puppy-comfort-video',
    code: 'tissue-puppy-comfort-ar',
    name: '纸巾小狗 AR 召唤',
    isPrimary: true,
    resources: [],
    authoringProtocol: {
      createFlow: 'single_resource_node',
      unitLabel: 'AR 召唤节点',
    },
    contentShape: {
      unit: 'comfort_ar_node',
      slots: [{ key: 'comfort_ar_overlay', role: 'ar_overlay', type: 'video', label: 'AR 召唤视频', required: true }],
    },
  }];

  const tokenFlow = buildDefinitionDrivenStudioFlow(guides);
  const officialFlow = buildDefinitionDrivenStudioFlow(guides, {
    submitAction: 'save_official_definition_content',
    publishAction: 'publish_official_definition_content',
  });

  assert.equal(tokenFlow.submitAction, 'save_definition_content_by_token');
  assert.equal(tokenFlow.steps.at(-2).options[0].action, 'preview_authoring_content');
  assert.equal(tokenFlow.steps.at(-1).options[0].action, 'publish_definition_content');
  assert.equal(officialFlow.submitAction, 'save_official_definition_content');
  assert.equal(officialFlow.steps.at(-2).options[0].action, 'preview_authoring_content');
  assert.equal(officialFlow.steps.at(-1).options[0].action, 'publish_official_definition_content');
});

test('content rendering protocol routes video content to runtime preview', () => {
  const content = {
    id: 'content-1',
    content_kind: 'video',
    payload: { renderer: 'video.fullscreen' },
  };

  assert.equal(inferContentRenderer(content), 'video.fullscreen');
  assert.equal(buildContentPreviewRoute(content), '/play/content-1');
});

test('content rendering protocol routes AR content to runtime preview', () => {
  const content = {
    id: 'content-ar',
    content_kind: 'ar',
    content_definition_template: { renderer: 'ar.camera-overlay' },
    payload: { renderer: 'video.fullscreen' },
  };

  assert.equal(inferContentRenderer(content), 'ar.camera-overlay');
  assert.equal(buildContentPreviewRoute(content), '/play/content-ar');
});

test('OS entry prompt uses app manifest display rules for Tissue Puppy NFC surfaces', () => {
  const unboundPrompt = buildOsEntryPrompt({
    surface: 'nfc_player',
    appCode: 'tissue-puppy',
    token: 'token-puppy',
    object: { id: 'ipinst-puppy', owner_user_id: null },
  });
  const boundPrompt = buildOsEntryPrompt({
    surface: 'nfc_player',
    appCode: 'tissue-puppy',
    token: 'token-puppy',
    object: { id: 'ipinst-puppy', owner_user_id: 'user-1' },
  });

  assert.equal(unboundPrompt.display, 'bottom_card');
  assert.equal(unboundPrompt.frequency, 'once_per_token');
  assert.equal(unboundPrompt.primary_action.target, '/assets?key=token-puppy&source=nfc_player');
  assert.equal(boundPrompt.display, 'corner_link');
  assert.equal(boundPrompt.frequency, 'always');
  assert.ok(boundPrompt.title.includes('Mint Space') || boundPrompt.primary_action.label.includes('Mint Space'));
});

test('OS entry prompt uses app manifest display rules for Desktop Secret NFC surfaces', () => {
  const unboundPrompt = buildOsEntryPrompt({
    surface: 'nfc_player',
    appCode: 'desktop-secret',
    token: 'token-desk',
    object: { id: 'ipinst-desk', owner_user_id: null },
  });
  const boundPrompt = buildOsEntryPrompt({
    surface: 'nfc_player',
    appCode: 'desktop-secret',
    token: 'token-desk',
    object: { id: 'ipinst-desk', owner_user_id: 'user-1' },
  });

  assert.equal(unboundPrompt.display, 'bottom_card');
  assert.equal(unboundPrompt.frequency, 'once_per_token');
  assert.equal(unboundPrompt.primary_action.target, '/assets?key=token-desk&source=nfc_player');
  assert.equal(boundPrompt.display, 'corner_link');
  assert.equal(boundPrompt.frequency, 'always');
  assert.ok(unboundPrompt.title.includes('桌面秘境'));
  assert.ok(boundPrompt.title.includes('桌面秘境'));
});

test('Mint Studio library only lists definition-authored content assets', async () => {
  const db = await createMintStudioLibraryDb();
  const items = buildCoreContentLibraryItems(db, { user: { id: 'user-1', username: 'creator' } });

  assert.equal(items.length, 1);
  assert.equal(items[0].contentInstanceId, 'content-puppy');
  assert.equal(items[0].contentDefinitionId, 'cntdef-puppy');
  assert.equal(items[0].ipDefinitionId, 'ip-puppy');
  assert.equal(items[0].ipInstanceId, 'ipinst-puppy');
  assert.equal(items[0].previewRoute, '/play/content-puppy');
});

test('core token playback resolves the IP instance default content through relation links', async () => {
  const db = await createMintStudioLibraryDb();
  const content = resolveDefaultContentForIpInstance(db, {
    id: 'ipinst-puppy',
    ip_definition_id: 'ip-puppy',
  });

  assert.equal(content.id, 'content-puppy');
  assert.equal(content.relation_role, 'owner_default');
  assert.equal(inferContentRenderer(content), 'ar.camera-overlay');
});

test('IP instance default content only accepts published playable content', async () => {
  const db = await createMintStudioLibraryDb();
  db.run(`INSERT INTO content_instances
    (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
     origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
     status, payload_json, created_at, updated_at)
    VALUES
    ('content-puppy-draft', 'ip-puppy', 'cntdef-puppy', 'app-puppy', 'user-1', 'user-1',
     'ipinst-puppy', '纸巾小狗 · 草稿', '草稿内容', 'ar', 'video', 'user', 'private', 'owner',
     'draft', '{"source":"mint-studio-definition-authoring"}', '2026-07-20', '2026-07-20')`);

  assert.throws(() => setAssetInstanceDefaultContent(db, {
    entity: {
      id: 'ipinst-puppy',
      ip_definition_id: 'ip-puppy',
      owner_user_id: 'user-1',
      token: 'token-1',
    },
    contentId: 'content-puppy-draft',
    actorUser: { id: 'user-1', username: 'user' },
  }), /已发布/);
});

test('OS asset links keep only one primary content per IP instance relation role', async () => {
  const db = await createMintStudioLibraryDb();
  db.run(`INSERT INTO content_instances
    (id, ip_definition_id, content_definition_id, application_definition_id, owner_user_id, creator_user_id,
     origin_ip_instance_id, title, summary, content_kind, primary_modality, source_type, visibility, access_scope,
     status, payload_json, created_at, updated_at)
    VALUES
    ('content-puppy-alt', 'ip-puppy', 'cntdef-puppy', 'app-puppy', 'user-1', 'user-1',
     'ipinst-puppy', '纸巾小狗 · 备用默认', '备用默认内容', 'ar', 'video', 'user', 'private', 'owner',
     'published', '{"source":"contract"}', '2026-07-20', '2026-07-20')`);

  upsertIpInstanceContentLink(db, {
    ipInstanceId: 'ipinst-puppy',
    contentInstanceId: 'content-puppy-alt',
    relationRole: 'owner_default',
    isPrimary: true,
  });

  const rows = db.exec(
    `SELECT content_instance_id, is_primary
     FROM ip_instance_content_instance_links
     WHERE ip_instance_id = ?
       AND relation_role = ?
     ORDER BY is_primary DESC, content_instance_id`,
    ['ipinst-puppy', 'owner_default']
  )[0].values;

  assert.equal(rows.filter((row) => Number(row[1]) === 1).length, 1);
  assert.equal(rows.find((row) => Number(row[1]) === 1)[0], 'content-puppy-alt');
});

test('OS resource binding hydrates ready resources before building content nodes', async () => {
  const db = await createMintStudioLibraryDb();
  const bindingConfig = getContentDefinitionBindingConfig({
    authoringProtocol: { unitLabel: '内容节点' },
    contentShape: {
      slots: [
        { key: 'comfort_ar_overlay', role: 'ar_overlay', type: 'video', label: 'AR 召唤视频', required: true },
      ],
    },
  });

  const resources = hydrateAuthoringResources(db, [
    {
      id: 'res-puppy',
      slot_key: 'comfort_ar_overlay',
      relation_role: 'ar_overlay',
      unit_index: 1,
    },
  ], {
    ownerUserId: 'user-1',
  });

  assertContentResourcesMatchDefinition(resources, bindingConfig);
  const nodes = buildContentResourceNodes(resources, { unitLabel: bindingConfig.unitLabel });
  const blocks = buildContentBlocksFromNodes(nodes);

  assert.equal(resources[0].storage_url, '/video.mp4');
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].resources[0].resource_type, 'video');
  assert.ok(blocks.some(block => block.kind === 'video' && block.url === '/video.mp4'));
});

test('content detail edit uses resource replacement drafts for definition-authored content', async () => {
  const db = await createMintStudioLibraryDb();
  const recipe = buildContentAuthoringRecipe(db, 'content-puppy', 'revise');

  assert.equal(recipe.recipe.studioFlow.kind, 'content_resource_replacement');
  assert.equal(recipe.recipe.studioFlow.steps[0].type, 'resource_upload');
  assert.equal(recipe.recipe.studioFlow.steps[0].slotKey, 'comfort_ar_overlay');

  const draft = createContentVersionDraft(db, {
    contentInstanceId: 'content-puppy',
    mode: 'revise',
    createdBy: 'user-1',
    resources: [{
      id: 'res-puppy-new',
      slot_key: 'comfort_ar_overlay',
      relation_role: 'ar_overlay',
      unit_index: 1,
    }],
  });

  assert.equal(draft.status, 'draft');
  assert.equal(draft.payload.authoring.latestDraft.resourceReplacement, true);
  assert.equal(draft.resource_snapshot[0].resourceId, 'res-puppy-new');

  publishContentVersion(db, {
    contentInstanceId: 'content-puppy',
    versionId: draft.id,
    publishedBy: 'user-1',
  });

  const linkedResource = db.exec(
    `SELECT resource_id
     FROM content_instance_resource_links
     WHERE content_instance_id = ?
       AND is_primary = 1
     LIMIT 1`,
    ['content-puppy']
  )[0].values[0][0];
  assert.equal(linkedResource, 'res-puppy-new');
});
