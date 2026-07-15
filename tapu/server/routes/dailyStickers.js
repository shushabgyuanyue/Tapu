import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import { serverMessages } from '../copy/messages.js';
import { recordObjectEvent } from '../services/objectEvents.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { buildContentBlocksForDailyStickerEntry, buildTapResponse } from '../services/tapRuntime.js';
import { buildRuntimeContextForObject } from '../services/contentOperation.js';
import { assembleDailyStickerExperience } from '../services/dailyStickerExperience.js';
import { adminRoute, loginRoute, registerRoutes } from '../services/routePermissions.js';
import {
  DEFAULT_DAILY_STICKER_RELEASE_CRON,
  DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE,
  buildEntryParams,
  buildReleaseContext,
  buildStickerAsset,
  cleanString,
  getConfigValue,
  getEntryAssets,
  getEntryForToken,
  getPersona,
  getStoryArc,
  getWorld,
  hasRenderableEntryContent,
  normalizeEntryAssets,
  normalizeJsonField,
  parsePositiveInt,
  parseOptionalInt,
  parseReleaseCron,
  recordDailyStickerOwnershipEvent,
  replaceEntryAssets,
  resolveStoryProgress,
  setConfigValue,
} from '../services/dailyStickerRuntime.js';

const router = Router();

router.get('/resolve', async (req, res) => {
  try {
    const db = await getDb();
    const resolvedObject = resolveObjectByToken(db, req.query.key);
    if (!resolvedObject || resolvedObject.app.code !== 'daily-sticker') {
      return res.status(400).json({ error: serverMessages.routes.dailySticker.tokenRequired });
    }
    const tokenRow = resolvedObject.raw;

    if (!tokenRow || tokenRow.status !== 'active' || tokenRow.persona_status !== 'active') {
      return res.status(404).json({ error: serverMessages.routes.dailySticker.inactive });
    }

    const persona = getPersona(db, tokenRow.persona_id);
    const world = getWorld(db, tokenRow.world_id);
    const storyArc = getStoryArc(db, tokenRow.story_arc_id);
    const defaultCron = getConfigValue(db, 'daily_sticker_release_cron', DEFAULT_DAILY_STICKER_RELEASE_CRON);
    const defaultTimezone = getConfigValue(db, 'daily_sticker_release_timezone', DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE);
    const effectiveCron = storyArc?.release_cron || defaultCron;
    const effectiveTimezone = storyArc?.release_timezone || defaultTimezone;
    const releaseContext = buildReleaseContext({
      cron: effectiveCron,
      timeZone: effectiveTimezone,
      dateOverride: cleanString(req.query.date),
    });
    const entry = getEntryForToken(db, tokenRow, releaseContext, req.query.day, storyArc);
    const progress = resolveStoryProgress(tokenRow, releaseContext, req.query.day, storyArc);
    const assets = getEntryAssets(db, entry?.id);

    db.run(
      'INSERT INTO daily_sticker_tap_events (token_id, persona_id, entry_id, user_agent) VALUES (?, ?, ?, ?)',
      [tokenRow.id, tokenRow.persona_id, entry?.id || null, req.headers['user-agent'] || null]
    );
    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: resolvedObject.app.code,
      eventType: 'daily_sticker_tap',
      contentId: entry?.id || null,
      userId: tokenRow.user_id || null,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        personaId: tokenRow.persona_id,
        worldId: tokenRow.world_id,
        storyArcId: tokenRow.story_arc_id,
        personaName: persona?.name || null,
        worldName: world?.name || null,
        currentDay: progress?.current_day || entry?.day_index || null,
        requestedDate: releaseContext.date_key,
      },
    });
    saveDb();

    const runtimeContext = buildRuntimeContextForObject(db, resolvedObject, {
      userId: tokenRow.user_id || req.user?.id || null,
      token: tokenRow.token,
    });
    const baseBlocks = buildContentBlocksForDailyStickerEntry({ entry, assets, persona });
    const assembledBlocks = assembleDailyStickerExperience(baseBlocks, runtimeContext);

    const tapResponse = buildTapResponse({
      object: resolvedObject.object,
      app: resolvedObject.app,
      content: {
        title: world?.name || persona?.name || tokenRow.label || serverMessages.routes.dailySticker.fallbackTitle,
        subtitle: world?.premise || persona?.tagline || null,
        themeColor: world?.theme_color || persona?.theme_color || '#ff4fd8',
        blocks: assembledBlocks,
      },
      actions: [
        { code: 'refresh_story', label: serverMessages.routes.dailySticker.refresh },
      ],
      permissions: {
        anonymousTap: true,
        ownerRequired: false,
      },
    });

    res.json({
      ...tapResponse,
      token: {
        id: tokenRow.id,
        label: tokenRow.label,
        token: tokenRow.token,
        progress_mode: tokenRow.progress_mode,
        story_start_date: tokenRow.story_start_date,
        day_offset: tokenRow.day_offset,
      },
      persona,
      world,
      story_arc: storyArc,
      entry: entry ? { ...entry, assets } : null,
      current_day: progress?.current_day || entry?.day_index || null,
      current_story_day_raw: progress?.raw_day || null,
      requested_date: releaseContext.date_key,
      release: releaseContext,
      runtime_context: runtimeContext,
    });
  } catch (error) {
    console.error('Resolve daily sticker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function listMyStickerAssets(req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT t.*, p.name as persona_name, p.object_type, p.cover_url as persona_cover_url,
              w.name as world_name, w.cover_url as world_cover_url,
              sa.title as story_arc_title, sa.total_days
       FROM daily_sticker_tokens t
       LEFT JOIN daily_sticker_personas p ON p.id = t.persona_id
       LEFT JOIN daily_sticker_worlds w ON w.id = t.world_id
       LEFT JOIN daily_sticker_story_arcs sa ON sa.id = t.story_arc_id
       WHERE t.user_id = ?
       ORDER BY COALESCE(t.bound_at, t.created_at) DESC`,
      [req.user.id]
    ));
    res.json(rows.map(row => buildStickerAsset(db, row)));
  } catch (error) {
    console.error('List my daily sticker assets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function bindDailyStickerTokenHandler(req, res) {
  try {
    const { db, accountObject: tokenRow } = req.permission;
    const persona = resultToObjects(db.exec(
      'SELECT status FROM daily_sticker_personas WHERE id = ? LIMIT 1',
      [tokenRow.persona_id]
    ))[0] || null;
    if (tokenRow.status !== 'active' || persona?.status !== 'active') {
      return res.status(400).json({ error: serverMessages.routes.dailySticker.notBindable });
    }

    db.run(
      'UPDATE daily_sticker_tokens SET user_id = ?, bound_at = CURRENT_TIMESTAMP, unbound_at = NULL WHERE id = ?',
      [req.user.id, tokenRow.id]
    );
    if (!tokenRow.user_id) {
      recordDailyStickerOwnershipEvent(db, {
        tokenId: tokenRow.id,
        token: tokenRow.token,
        eventType: 'bind',
        toUserId: req.user.id,
        actorUserId: req.user.id,
        orderId: tokenRow.external_order_no || null,
        note: serverMessages.routes.dailySticker.bindNote,
      });
    }
    saveDb();
    res.json({ success: true, token_id: tokenRow.id, already_bound: tokenRow.user_id === req.user.id });
  } catch (error) {
    console.error('Bind daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function unbindDailyStickerTokenHandler(req, res) {
  try {
    const { db, accountObjectId: tokenId, accountObject: tokenRow } = req.permission;

    db.run('UPDATE daily_sticker_tokens SET user_id = NULL, unbound_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenId]);
    recordDailyStickerOwnershipEvent(db, {
      tokenId,
      token: tokenRow.token,
      eventType: 'unbind',
      fromUserId: req.user.id,
      actorUserId: req.user.id,
      orderId: tokenRow.external_order_no || null,
      note: serverMessages.routes.dailySticker.unbindNote,
    });
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Unbind daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listTemplates(_req, res) {
  try {
    const db = await getDb();
    res.json(resultToObjects(db.exec('SELECT * FROM daily_sticker_templates ORDER BY code ASC')));
  } catch (error) {
    console.error('List daily sticker templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listVisualStyles(_req, res) {
  try {
    const db = await getDb();
    res.json(resultToObjects(db.exec('SELECT * FROM daily_sticker_visual_styles ORDER BY style_layer ASC, code ASC')));
  } catch (error) {
    console.error('List daily sticker visual styles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSettings(_req, res) {
  try {
    const db = await getDb();
    const release_cron = getConfigValue(db, 'daily_sticker_release_cron', DEFAULT_DAILY_STICKER_RELEASE_CRON);
    const release_timezone = getConfigValue(db, 'daily_sticker_release_timezone', DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE);
    res.json({
      release_cron,
      release_timezone,
      cron_valid: parseReleaseCron(release_cron).valid,
    });
  } catch (error) {
    console.error('Get daily sticker settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateSettings(req, res) {
  try {
    const releaseCron = cleanString(req.body.release_cron) || DEFAULT_DAILY_STICKER_RELEASE_CRON;
    const releaseTimezone = cleanString(req.body.release_timezone) || DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE;
    const parsed = parseReleaseCron(releaseCron);
    if (!parsed.valid) {
      return res.status(400).json({ error: '支持分钟级 cron（如 */1 * * * *）或日级 cron（如 0 8 * * *）' });
    }
    const db = await getDb();
    setConfigValue(db, 'daily_sticker_release_cron', releaseCron);
    setConfigValue(db, 'daily_sticker_release_timezone', releaseTimezone);
    saveDb();
    res.json({ success: true, release_cron: releaseCron, release_timezone: releaseTimezone });
  } catch (error) {
    console.error('Update daily sticker settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listWorlds(req, res) {
  try {
    const db = await getDb();
    const conditions = [];
    const params = [];
    if (req.query.persona_id) {
      conditions.push('w.persona_id = ?');
      params.push(req.query.persona_id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = resultToObjects(db.exec(
      `SELECT w.*, p.name as persona_name,
              COALESCE((SELECT COUNT(*) FROM daily_sticker_story_arcs sa WHERE sa.world_id = w.id), 0) as story_count
       FROM daily_sticker_worlds w
       LEFT JOIN daily_sticker_personas p ON p.id = w.persona_id
       ${where}
       ORDER BY w.created_at DESC`,
      params
    ));
    res.json(rows);
  } catch (error) {
    console.error('List daily sticker worlds error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createWorld(req, res) {
  try {
    const personaId = cleanString(req.body.persona_id);
    const name = cleanString(req.body.name);
    if (!personaId || !name) return res.status(400).json({ error: 'persona_id and name are required' });

    const db = await getDb();
    const id = uuidv4();
    db.run(
      `INSERT INTO daily_sticker_worlds
       (id, persona_id, name, slug, premise, worldview, atmosphere, narrative_voice,
        expression_style, cover_url, theme_color, theme_tokens_json, release_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        personaId,
        name,
        cleanString(req.body.slug) || null,
        cleanString(req.body.premise) || null,
        cleanString(req.body.worldview) || null,
        cleanString(req.body.atmosphere) || null,
        cleanString(req.body.narrative_voice) || null,
        cleanString(req.body.expression_style) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || '#ff4fd8',
        normalizeJsonField(req.body.theme_tokens_json),
        cleanString(req.body.release_mode) || 'calendar_day',
        cleanString(req.body.status) || 'active',
      ]
    );
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create daily sticker world error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateWorld(req, res) {
  try {
    const db = await getDb();
    db.run(
      `UPDATE daily_sticker_worlds
       SET persona_id = ?, name = ?, slug = ?, premise = ?, worldview = ?, atmosphere = ?,
           narrative_voice = ?, expression_style = ?, cover_url = ?, theme_color = ?,
           theme_tokens_json = ?, release_mode = ?, status = ?
       WHERE id = ?`,
      [
        cleanString(req.body.persona_id),
        cleanString(req.body.name),
        cleanString(req.body.slug) || null,
        cleanString(req.body.premise) || null,
        cleanString(req.body.worldview) || null,
        cleanString(req.body.atmosphere) || null,
        cleanString(req.body.narrative_voice) || null,
        cleanString(req.body.expression_style) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || '#ff4fd8',
        normalizeJsonField(req.body.theme_tokens_json),
        cleanString(req.body.release_mode) || 'calendar_day',
        cleanString(req.body.status) || 'active',
        req.params.id,
      ]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update daily sticker world error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listStoryArcs(req, res) {
  try {
    const db = await getDb();
    const conditions = [];
    const params = [];
    if (req.query.world_id) {
      conditions.push('sa.world_id = ?');
      params.push(req.query.world_id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = resultToObjects(db.exec(
      `SELECT sa.*, w.name as world_name, w.persona_id,
              COALESCE((SELECT COUNT(*) FROM daily_sticker_entries e WHERE e.story_arc_id = sa.id), 0) as entry_count
       FROM daily_sticker_story_arcs sa
       LEFT JOIN daily_sticker_worlds w ON w.id = sa.world_id
       ${where}
       ORDER BY sa.created_at DESC`,
      params
    ));
    res.json(rows);
  } catch (error) {
    console.error('List daily sticker story arcs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createStoryArc(req, res) {
  try {
    const worldId = cleanString(req.body.world_id);
    const title = cleanString(req.body.title);
    if (!worldId || !title) return res.status(400).json({ error: 'world_id and title are required' });
    const releaseCron = cleanString(req.body.release_cron) || DEFAULT_DAILY_STICKER_RELEASE_CRON;
    if (!parseReleaseCron(releaseCron).valid) return res.status(400).json({ error: '支持分钟级 cron（如 */1 * * * *）或日级 cron（如 0 8 * * *）' });

    const db = await getDb();
    const id = uuidv4();
    db.run(
      `INSERT INTO daily_sticker_story_arcs
       (id, world_id, title, summary, source_format, markdown_source, total_days,
        starts_on, release_cron, release_timezone, status, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        worldId,
        title,
        cleanString(req.body.summary) || null,
        cleanString(req.body.source_format) || 'markdown',
        cleanString(req.body.markdown_source) || null,
        parsePositiveInt(req.body.total_days, 30),
        cleanString(req.body.starts_on) || null,
        releaseCron,
        cleanString(req.body.release_timezone) || DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE,
        cleanString(req.body.status) || 'draft',
      ]
    );
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create daily sticker story arc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateStoryArc(req, res) {
  try {
    const releaseCron = cleanString(req.body.release_cron) || DEFAULT_DAILY_STICKER_RELEASE_CRON;
    if (!parseReleaseCron(releaseCron).valid) return res.status(400).json({ error: '支持分钟级 cron（如 */1 * * * *）或日级 cron（如 0 8 * * *）' });
    const db = await getDb();
    db.run(
      `UPDATE daily_sticker_story_arcs
       SET world_id = ?, title = ?, summary = ?, source_format = ?, markdown_source = ?,
           total_days = ?, starts_on = ?, release_cron = ?, release_timezone = ?,
           status = ?, imported_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        cleanString(req.body.world_id),
        cleanString(req.body.title),
        cleanString(req.body.summary) || null,
        cleanString(req.body.source_format) || 'markdown',
        cleanString(req.body.markdown_source) || null,
        parsePositiveInt(req.body.total_days, 30),
        cleanString(req.body.starts_on) || null,
        releaseCron,
        cleanString(req.body.release_timezone) || DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE,
        cleanString(req.body.status) || 'draft',
        req.params.id,
      ]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update daily sticker story arc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listPersonas(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT p.*,
              COUNT(DISTINCT e.id) as entry_count,
              COUNT(DISTINCT t.id) as token_count
       FROM daily_sticker_personas p
       LEFT JOIN daily_sticker_entries e ON e.persona_id = p.id
       LEFT JOIN daily_sticker_tokens t ON t.persona_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('List daily sticker personas error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createPersona(req, res) {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写人格名称' });

    const db = await getDb();
    const id = uuidv4();
    db.run(
      `INSERT INTO daily_sticker_personas
       (id, name, object_type, tagline, voice, world_summary, worldview, atmosphere,
        expression_style, cover_url, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        cleanString(req.body.object_type) || null,
        cleanString(req.body.tagline) || null,
        cleanString(req.body.voice) || null,
        cleanString(req.body.world_summary) || null,
        cleanString(req.body.worldview) || null,
        cleanString(req.body.atmosphere) || null,
        cleanString(req.body.expression_style) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || '#ff4fd8',
        cleanString(req.body.status) || 'active',
      ]
    );
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create daily sticker persona error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updatePersona(req, res) {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写人格名称' });

    const db = await getDb();
    db.run(
      `UPDATE daily_sticker_personas
       SET name = ?, object_type = ?, tagline = ?, voice = ?, world_summary = ?,
           worldview = ?, atmosphere = ?, expression_style = ?, cover_url = ?,
           theme_color = ?, status = ?
       WHERE id = ?`,
      [
        name,
        cleanString(req.body.object_type) || null,
        cleanString(req.body.tagline) || null,
        cleanString(req.body.voice) || null,
        cleanString(req.body.world_summary) || null,
        cleanString(req.body.worldview) || null,
        cleanString(req.body.atmosphere) || null,
        cleanString(req.body.expression_style) || null,
        cleanString(req.body.cover_url) || null,
        cleanString(req.body.theme_color) || '#ff4fd8',
        cleanString(req.body.status) || 'active',
        req.params.id,
      ]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update daily sticker persona error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deletePersona(req, res) {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_personas WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker persona error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listEntries(req, res) {
  try {
    const db = await getDb();
    const conditions = [];
    const params = [];
    if (req.query.persona_id) {
      conditions.push('e.persona_id = ?');
      params.push(req.query.persona_id);
    }
    if (req.query.story_arc_id) {
      conditions.push('e.story_arc_id = ?');
      params.push(req.query.story_arc_id);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = resultToObjects(db.exec(
      `SELECT e.*, p.name as persona_name,
              COALESCE((SELECT COUNT(*) FROM daily_sticker_entry_assets a WHERE a.entry_id = e.id), 0) as asset_count
       FROM daily_sticker_entries e
       LEFT JOIN daily_sticker_personas p ON p.id = e.persona_id
       ${where}
       ORDER BY e.entry_date DESC, e.created_at DESC`,
      params
    ));
    res.json(rows);
  } catch (error) {
    console.error('List daily sticker entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createEntry(req, res) {
  try {
    const personaId = cleanString(req.body.persona_id);
    const body = cleanString(req.body.body);
    const entryDate = cleanString(req.body.entry_date);
    if (!personaId || !entryDate || !hasRenderableEntryContent(req, body)) {
      return res.status(400).json({ error: '请填写人格、日期，并至少提供正文、素材或结构化内容' });
    }

    const db = await getDb();
    if (!getPersona(db, personaId)) return res.status(404).json({ error: '贴纸人格不存在' });

    const id = uuidv4();
    const assets = normalizeEntryAssets(req.body.assets);
    db.run(
      `INSERT INTO daily_sticker_entries
       (id, persona_id, world_id, story_arc_id, day_index, entry_date, title, body,
        markdown_source, content_json, template_code, visual_style_code, primary_modality,
        layout_hint, mood, quote, quote_author, image_url, motion_preset, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      buildEntryParams(req, id, personaId, body, entryDate, assets)
    );
    replaceEntryAssets(db, id, req.body.assets);
    saveDb();
    res.json({ success: true, id, asset_count: assets.length });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: '该人格当天内容已存在' });
    }
    console.error('Create daily sticker entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateEntry(req, res) {
  try {
    const personaId = cleanString(req.body.persona_id);
    const body = cleanString(req.body.body);
    const entryDate = cleanString(req.body.entry_date);
    if (!personaId || !entryDate || !hasRenderableEntryContent(req, body)) {
      return res.status(400).json({ error: '请填写人格、日期，并至少提供正文、素材或结构化内容' });
    }

    const db = await getDb();
    const assets = normalizeEntryAssets(req.body.assets);
    const params = buildEntryParams(req, req.params.id, personaId, body, entryDate, assets);
    db.run(
      `UPDATE daily_sticker_entries
       SET persona_id = ?, world_id = ?, story_arc_id = ?, day_index = ?, entry_date = ?,
           title = ?, body = ?, markdown_source = ?, content_json = ?, template_code = ?,
           visual_style_code = ?, primary_modality = ?, layout_hint = ?, mood = ?,
           quote = ?, quote_author = ?, image_url = ?, motion_preset = ?, status = ?
       WHERE id = ?`,
      [...params.slice(1), req.params.id]
    );
    replaceEntryAssets(db, req.params.id, req.body.assets);
    saveDb();
    res.json({ success: true, asset_count: assets.length });
  } catch (error) {
    console.error('Update daily sticker entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteEntry(req, res) {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_entries WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listTokens(req, res) {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 20);
    const shouldPaginate = req.query.page !== undefined || req.query.page_size !== undefined;
    const conditions = [];
    const params = [];
    if (req.query.persona_id) {
      conditions.push('t.persona_id = ?');
      params.push(req.query.persona_id);
    }
    if (req.query.q) {
      conditions.push('(t.token LIKE ? OR t.label LIKE ? OR p.name LIKE ? OR w.name LIKE ? OR sa.title LIKE ? OR u.username LIKE ?)');
      const q = `%${req.query.q}%`;
      params.push(q, q, q, q, q, q);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM daily_sticker_tokens t
      LEFT JOIN daily_sticker_personas p ON p.id = t.persona_id
      LEFT JOIN daily_sticker_worlds w ON w.id = t.world_id
      LEFT JOIN daily_sticker_story_arcs sa ON sa.id = t.story_arc_id
      LEFT JOIN users u ON u.id = t.user_id
      ${where}`;
    const totalRows = resultToObjects(db.exec(`SELECT COUNT(*) as total ${fromSql}`, params));
    const total = totalRows[0]?.total || 0;
    const rows = resultToObjects(db.exec(
      `SELECT t.*, p.name as persona_name, p.object_type as object_type,
              w.name as world_name, sa.title as story_arc_title, u.username as owner_username
       ${fromSql}
       ORDER BY t.created_at DESC${shouldPaginate ? ' LIMIT ? OFFSET ?' : ''}`,
      shouldPaginate ? [...params, pageSize, (page - 1) * pageSize] : params
    ));
    if (shouldPaginate) {
      return res.json({ items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
    }
    res.json(rows);
  } catch (error) {
    console.error('List daily sticker tokens error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createTokens(req, res) {
  try {
    const personaId = cleanString(req.body.persona_id);
    if (!personaId) return res.status(400).json({ error: '请选择贴纸人格' });

    const db = await getDb();
    if (!getPersona(db, personaId)) return res.status(404).json({ error: '贴纸人格不存在' });

    const count = Math.min(parsePositiveInt(req.body.count, 1), 100);
    const tokens = [];
    const customToken = normalizeEntityToken(req.body.token);
    if (customToken && count > 1) return res.status(400).json({ error: '批量生成时不能指定固定 token' });
    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const token = customToken || createUniqueToken(db, 'daily_sticker_tokens', 'token', 'daily sticker token');
      const label = cleanString(req.body.label) || null;
      const existing = resultToObjects(db.exec('SELECT id FROM daily_sticker_tokens WHERE token = ? LIMIT 1', [token]));
      if (existing.length > 0) return res.status(400).json({ error: 'token 已存在' });
      const finalLabel = count > 1 && label ? `${label}-${i + 1}` : label;
      db.run(
        `INSERT INTO daily_sticker_tokens
         (id, persona_id, world_id, story_arc_id, token, label, progress_mode, story_start_date, day_offset, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          personaId,
          cleanString(req.body.world_id) || null,
          cleanString(req.body.story_arc_id) || null,
          token,
          finalLabel,
          cleanString(req.body.progress_mode) || 'calendar_day',
          cleanString(req.body.story_start_date) || null,
          parseOptionalInt(req.body.day_offset) || 0,
          cleanString(req.body.status) || 'active',
        ]
      );
      tokens.push({ id, token, label: finalLabel });
    }
    saveDb();
    res.json({ success: true, tokens });
  } catch (error) {
    console.error('Create daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateToken(req, res) {
  try {
    const db = await getDb();
    db.run(
      `UPDATE daily_sticker_tokens
       SET persona_id = ?, world_id = ?, story_arc_id = ?, label = ?, progress_mode = ?,
           story_start_date = ?, day_offset = ?, status = ?
       WHERE id = ?`,
      [
        cleanString(req.body.persona_id),
        cleanString(req.body.world_id) || null,
        cleanString(req.body.story_arc_id) || null,
        cleanString(req.body.label) || null,
        cleanString(req.body.progress_mode) || 'calendar_day',
        cleanString(req.body.story_start_date) || null,
        parseOptionalInt(req.body.day_offset) || 0,
        cleanString(req.body.status) || 'active',
        req.params.id,
      ]
    );
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteToken(req, res) {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_tokens WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  loginRoute('get', '/my-assets', listMyStickerAssets),
  adminRoute('get', '/templates', listTemplates),
  adminRoute('get', '/visual-styles', listVisualStyles),
  adminRoute('get', '/settings', getSettings),
  adminRoute('put', '/settings', updateSettings),
  adminRoute('get', '/worlds', listWorlds),
  adminRoute('post', '/worlds', createWorld),
  adminRoute('put', '/worlds/:id', updateWorld),
  adminRoute('get', '/story-arcs', listStoryArcs),
  adminRoute('post', '/story-arcs', createStoryArc),
  adminRoute('put', '/story-arcs/:id', updateStoryArc),
  adminRoute('get', '/personas', listPersonas),
  adminRoute('post', '/personas', createPersona),
  adminRoute('put', '/personas/:id', updatePersona),
  adminRoute('delete', '/personas/:id', deletePersona),
  adminRoute('get', '/entries', listEntries),
  adminRoute('post', '/entries', createEntry),
  adminRoute('put', '/entries/:id', updateEntry),
  adminRoute('delete', '/entries/:id', deleteEntry),
  adminRoute('get', '/tokens', listTokens),
  adminRoute('post', '/tokens', createTokens),
  adminRoute('put', '/tokens/:id', updateToken),
  adminRoute('delete', '/tokens/:id', deleteToken),
  {
    method: 'post',
    path: '/bind-token',
    permission: {
      type: 'account_object_claimable',
      table: 'daily_sticker_tokens',
      tokenColumn: 'token',
      userColumn: 'user_id',
      label: serverMessages.routes.dailySticker.objectLabel,
    },
    operation: 'asset:claim',
    summary: 'Claim a daily sticker token into the current account.',
    body: { key: 'string' },
    response: { success: 'boolean', token_id: 'string', already_bound: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'ACCOUNT_OBJECT_NOT_FOUND', 'ACCOUNT_OBJECT_ALREADY_BOUND'],
    tags: ['daily-sticker', 'asset'],
    handler: bindDailyStickerTokenHandler,
  },
  {
    method: 'post',
    path: '/unbind-token',
    permission: {
      type: 'account_object_owner',
      table: 'daily_sticker_tokens',
      idColumn: 'id',
      userColumn: 'user_id',
      label: serverMessages.routes.dailySticker.assetLabel,
    },
    operation: 'asset:owner_manage',
    summary: 'Unbind an owned daily sticker token.',
    body: { token_id: 'string' },
    response: { success: 'boolean' },
    errors: ['LOGIN_REQUIRED', 'ACCOUNT_OBJECT_NOT_FOUND', 'ACCOUNT_OBJECT_OWNER_REQUIRED'],
    tags: ['daily-sticker', 'asset'],
    handler: unbindDailyStickerTokenHandler,
  },
]);

export default router;
