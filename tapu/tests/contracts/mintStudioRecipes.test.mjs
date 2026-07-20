import test from 'node:test';
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { findAppManifest } from '../../server/contracts/appManifests.js';
import { buildCoreContentLibraryItems } from '../../server/routes/mintStudio.js';
import { resolveDefaultContentForIpInstance } from '../../server/routes/contents.js';
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
import {
  assertContentResourcesMatchDefinition,
  buildContentBlocksFromNodes,
  buildContentResourceNodes,
  getContentDefinitionBindingConfig,
  hydrateAuthoringResources,
} from '../../server/services/contentResourceBinding.js';

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
    payload_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run('CREATE TABLE content_definitions (id TEXT PRIMARY KEY, code TEXT, name TEXT, authoring_schema_json TEXT, template_json TEXT)');
  db.run('CREATE TABLE ip_definitions (id TEXT PRIMARY KEY, name TEXT, primary_series_name TEXT)');
  db.run('CREATE TABLE application_definitions (id TEXT PRIMARY KEY, code TEXT, name TEXT)');
  db.run('CREATE TABLE ip_instances (id TEXT PRIMARY KEY, owner_user_id TEXT, token TEXT, entity_key TEXT)');
  db.run(`CREATE TABLE content_instance_resource_links (
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  db.run("INSERT INTO content_definitions (id, code, name, template_json) VALUES ('cntdef-puppy', 'tissue-puppy-comfort-ar', '纸巾小狗 AR 召唤', '{\"renderer\":\"ar.camera-overlay\"}')");
  db.run("INSERT INTO ip_definitions (id, name, primary_series_name) VALUES ('ip-puppy', '纸巾小狗', '永远系列')");
  db.run("INSERT INTO application_definitions (id, code, name) VALUES ('app-puppy', 'tissue-puppy', '纸巾小狗')");
  db.run("INSERT INTO ip_instances (id, owner_user_id, token, entity_key) VALUES ('ipinst-puppy', 'user-1', 'token-1', 'token-1')");
  db.run("INSERT INTO resources (id, owner_user_id, resource_type, storage_url, preview_url, status) VALUES ('res-puppy', 'user-1', 'video', '/video.mp4', '/poster.jpg', 'ready')");
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
     'published', '{"sourceTable":"content_collections"}', '2026-07-20', '2026-07-20')`);
  db.run(`INSERT INTO ip_instance_content_instance_links
    (id, ip_instance_id, content_instance_id, relation_role, is_primary, sort_order, metadata_json)
    VALUES ('link-puppy-owner-default', 'ipinst-puppy', 'content-puppy', 'owner_default', 1, 0, '{}')`);
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
  assert.equal(manifest.contentDefinition?.template?.renderer, 'ar.camera-overlay');
  assert.equal(manifest.contentDefinition?.template?.ar?.placement, 'screen_center');
  assert.equal(manifest.contentDefinition?.template?.playback?.mutedByDefault, true);
  assert.equal(manifest.contentDefinition?.template?.playback?.tapToUnmute, true);
  assert.equal(manifest.contentDefinition?.template?.playback?.replayMode, 'loop');
  assert.ok(profile.creationModes.some(mode => mode.code === 'collect_asset'));
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
