import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { authRequired } from '../middleware/auth.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';

const router = Router();

function adminOnly(req, res, next) {
  if (req.user.username !== 'admin') {
    return res.status(403).json({ error: '仅管理员可操作' });
  }
  next();
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function parseOptionalInt(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getConfigValue(db, key, fallback) {
  const rows = resultToObjects(db.exec('SELECT value FROM site_config WHERE key = ? LIMIT 1', [key]));
  return rows[0]?.value || fallback;
}

function setConfigValue(db, key, value) {
  const existing = resultToObjects(db.exec('SELECT key FROM site_config WHERE key = ? LIMIT 1', [key]));
  if (existing.length > 0) {
    db.run('UPDATE site_config SET value = ? WHERE key = ?', [String(value), key]);
  } else {
    db.run('INSERT INTO site_config (key, value) VALUES (?, ?)', [key, String(value)]);
  }
}

function parseDailyCron(cron) {
  const parts = String(cron || '').trim().split(/\s+/);
  if (parts.length !== 5) return { minute: 0, hour: 8, valid: false };
  const minute = Number(parts[0]);
  const hour = Number(parts[1]);
  const isDaily = parts[2] === '*' && parts[3] === '*' && parts[4] === '*';
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23 || !isDaily) {
    return { minute: 0, hour: 8, valid: false };
  }
  return { minute, hour, valid: true };
}

function localParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function dateKeyFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function releaseDateKey({ cron, timeZone }) {
  const { minute, hour } = parseDailyCron(cron);
  const parts = localParts(new Date(), timeZone || 'Asia/Shanghai');
  const currentKey = dateKeyFromParts(parts);
  if (parts.hour < hour || (parts.hour === hour && parts.minute < minute)) {
    return previousDateKey(currentKey);
  }
  return currentKey;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeJsonField(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  return JSON.stringify(value);
}

function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function normalizeEntryAssets(rawAssets) {
  if (!Array.isArray(rawAssets)) return [];
  return rawAssets
    .map((asset, index) => ({
      asset_type: cleanString(asset.asset_type || asset.type),
      role: cleanString(asset.role) || 'inline',
      url: cleanString(asset.url),
      alt_text: cleanString(asset.alt_text || asset.alt),
      metadata_json: normalizeJsonField(asset.metadata_json || asset.metadata),
      sort_order: Number.isFinite(Number(asset.sort_order)) ? Number(asset.sort_order) : index,
    }))
    .filter(asset => asset.asset_type && asset.url);
}

function hasRenderableEntryContent(req, body) {
  return Boolean(
    body ||
    cleanString(req.body.title) ||
    cleanString(req.body.markdown_source) ||
    normalizeJsonField(req.body.content_json) ||
    normalizeEntryAssets(req.body.assets).length > 0
  );
}

function getPersona(db, personaId) {
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_personas WHERE id = ? LIMIT 1', [personaId]))[0] || null;
}

function getWorld(db, worldId) {
  if (!worldId) return null;
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_worlds WHERE id = ? LIMIT 1', [worldId]))[0] || null;
}

function getStoryArc(db, storyArcId) {
  if (!storyArcId) return null;
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_story_arcs WHERE id = ? LIMIT 1', [storyArcId]))[0] || null;
}

function getEntryAssets(db, entryId) {
  if (!entryId) return [];
  return resultToObjects(db.exec(
    `SELECT * FROM daily_sticker_entry_assets
     WHERE entry_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [entryId]
  ));
}

function replaceEntryAssets(db, entryId, rawAssets) {
  if (!Array.isArray(rawAssets)) return;
  const assets = normalizeEntryAssets(rawAssets);
  db.run('DELETE FROM daily_sticker_entry_assets WHERE entry_id = ?', [entryId]);
  for (const asset of assets) {
    db.run(
      `INSERT INTO daily_sticker_entry_assets
       (id, entry_id, asset_type, role, url, alt_text, metadata_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), entryId, asset.asset_type, asset.role, asset.url, asset.alt_text || null, asset.metadata_json, asset.sort_order]
    );
  }
}

function getEntryForDate(db, personaId, entryDate) {
  const published = "status = 'published'";
  const exact = resultToObjects(db.exec(
    `SELECT * FROM daily_sticker_entries WHERE persona_id = ? AND entry_date = ? AND ${published} LIMIT 1`,
    [personaId, entryDate]
  ))[0];
  if (exact) return exact;

  const latestBefore = resultToObjects(db.exec(
    `SELECT * FROM daily_sticker_entries
     WHERE persona_id = ? AND entry_date <= ? AND ${published}
     ORDER BY entry_date DESC LIMIT 1`,
    [personaId, entryDate]
  ))[0];
  if (latestBefore) return latestBefore;

  return resultToObjects(db.exec(
    `SELECT * FROM daily_sticker_entries
     WHERE persona_id = ? AND ${published}
     ORDER BY entry_date DESC LIMIT 1`,
    [personaId]
  ))[0] || null;
}

function resolveStoryDay(tokenRow, entryDate, queryDay) {
  const explicitDay = parseOptionalInt(queryDay);
  if (explicitDay && explicitDay > 0) return explicitDay;
  if (tokenRow.progress_mode === 'story_day' && tokenRow.story_start_date) {
    const diff = daysBetween(tokenRow.story_start_date, entryDate);
    if (diff === null) return null;
    return diff + 1 + (Number(tokenRow.day_offset) || 0);
  }
  return null;
}

function getEntryForToken(db, tokenRow, entryDate, queryDay) {
  const published = "status = 'published'";
  if (tokenRow.story_arc_id) {
    const storyDay = resolveStoryDay(tokenRow, entryDate, queryDay);
    if (storyDay) {
      const byDay = resultToObjects(db.exec(
        `SELECT * FROM daily_sticker_entries
         WHERE story_arc_id = ? AND day_index = ? AND ${published}
         LIMIT 1`,
        [tokenRow.story_arc_id, storyDay]
      ))[0];
      if (byDay) return byDay;
    }

    const byDate = resultToObjects(db.exec(
      `SELECT * FROM daily_sticker_entries
       WHERE story_arc_id = ? AND entry_date = ? AND ${published}
       LIMIT 1`,
      [tokenRow.story_arc_id, entryDate]
    ))[0];
    if (byDate) return byDate;

    const latestBefore = resultToObjects(db.exec(
      `SELECT * FROM daily_sticker_entries
       WHERE story_arc_id = ? AND entry_date <= ? AND ${published}
       ORDER BY entry_date DESC, day_index DESC LIMIT 1`,
      [tokenRow.story_arc_id, entryDate]
    ))[0];
    if (latestBefore) return latestBefore;

    const firstStoryEntry = resultToObjects(db.exec(
      `SELECT * FROM daily_sticker_entries
       WHERE story_arc_id = ? AND ${published}
       ORDER BY day_index ASC, entry_date ASC LIMIT 1`,
      [tokenRow.story_arc_id]
    ))[0];
    if (firstStoryEntry) return firstStoryEntry;
  }

  return getEntryForDate(db, tokenRow.persona_id, entryDate);
}

function getDailyStickerTokenByValue(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;
  return resultToObjects(db.exec(
    `SELECT t.*, p.name as persona_name, p.status as persona_status
     FROM daily_sticker_tokens t
     JOIN daily_sticker_personas p ON p.id = t.persona_id
     WHERE t.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

function recordDailyStickerOwnershipEvent(db, params) {
  db.run(
    `INSERT INTO daily_sticker_ownership_events
     (id, token_id, token, event_type, from_user_id, to_user_id, actor_user_id, order_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      params.tokenId || null,
      params.token || null,
      params.eventType,
      params.fromUserId || null,
      params.toUserId || null,
      params.actorUserId || null,
      params.orderId || null,
      params.note || null,
    ]
  );
}

function buildStickerAsset(db, tokenRow) {
  const persona = getPersona(db, tokenRow.persona_id);
  const world = getWorld(db, tokenRow.world_id);
  const storyArc = getStoryArc(db, tokenRow.story_arc_id);
  const defaultCron = getConfigValue(db, 'daily_sticker_release_cron', '0 8 * * *');
  const defaultTimezone = getConfigValue(db, 'daily_sticker_release_timezone', 'Asia/Shanghai');
  const effectiveCron = storyArc?.release_cron || defaultCron;
  const effectiveTimezone = storyArc?.release_timezone || defaultTimezone;
  const entryDate = releaseDateKey({ cron: effectiveCron, timeZone: effectiveTimezone });
  const entry = getEntryForToken(db, tokenRow, entryDate);
  const progressDay = resolveStoryDay(tokenRow, entryDate);

  return {
    ...tokenRow,
    persona,
    world,
    story_arc: storyArc,
    current_entry: entry ? { ...entry, assets: getEntryAssets(db, entry.id) } : null,
    current_day: progressDay || entry?.day_index || null,
    release: { cron: effectiveCron, timezone: effectiveTimezone },
  };
}

function buildEntryParams(req, id, personaId, body, entryDate, assets) {
  const primaryModality = cleanString(req.body.primary_modality) || (assets[0]?.asset_type || 'text');
  return [
    id,
    personaId,
    cleanString(req.body.world_id) || null,
    cleanString(req.body.story_arc_id) || null,
    parseOptionalInt(req.body.day_index),
    entryDate,
    cleanString(req.body.title) || null,
    body || null,
    cleanString(req.body.markdown_source) || null,
    normalizeJsonField(req.body.content_json),
    cleanString(req.body.template_code) || 'story-card',
    cleanString(req.body.visual_style_code) || null,
    primaryModality,
    cleanString(req.body.layout_hint) || null,
    cleanString(req.body.mood) || null,
    cleanString(req.body.quote) || null,
    cleanString(req.body.quote_author) || null,
    cleanString(req.body.image_url) || null,
    cleanString(req.body.motion_preset) || 'float',
    cleanString(req.body.status) || 'published',
  ];
}

router.get('/resolve', async (req, res) => {
  try {
    const token = normalizeEntityToken(req.query.key);
    if (!token) return res.status(400).json({ error: '缺少贴纸 token' });

    const db = await getDb();
    const tokenRow = resultToObjects(db.exec(
      `SELECT t.*, p.name as persona_name, p.status as persona_status
       FROM daily_sticker_tokens t
       JOIN daily_sticker_personas p ON p.id = t.persona_id
       WHERE t.token = ? LIMIT 1`,
      [token]
    ))[0];

    if (!tokenRow || tokenRow.status !== 'active' || tokenRow.persona_status !== 'active') {
      return res.status(404).json({ error: '贴纸不存在或未启用' });
    }

    const persona = getPersona(db, tokenRow.persona_id);
    const world = getWorld(db, tokenRow.world_id);
    const storyArc = getStoryArc(db, tokenRow.story_arc_id);
    const defaultCron = getConfigValue(db, 'daily_sticker_release_cron', '0 8 * * *');
    const defaultTimezone = getConfigValue(db, 'daily_sticker_release_timezone', 'Asia/Shanghai');
    const effectiveCron = storyArc?.release_cron || defaultCron;
    const effectiveTimezone = storyArc?.release_timezone || defaultTimezone;
    const entryDate = cleanString(req.query.date) || releaseDateKey({ cron: effectiveCron, timeZone: effectiveTimezone });
    const entry = getEntryForToken(db, tokenRow, entryDate, req.query.day);
    const assets = getEntryAssets(db, entry?.id);

    db.run(
      'INSERT INTO daily_sticker_tap_events (token_id, persona_id, entry_id, user_agent) VALUES (?, ?, ?, ?)',
      [tokenRow.id, tokenRow.persona_id, entry?.id || null, req.headers['user-agent'] || null]
    );
    saveDb();

    res.json({
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
      requested_date: entryDate,
      release: { cron: effectiveCron, timezone: effectiveTimezone },
    });
  } catch (error) {
    console.error('Resolve daily sticker error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/my-assets', authRequired, async (req, res) => {
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
});

router.post('/bind-token', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const tokenRow = getDailyStickerTokenByValue(db, req.body?.key || req.body?.token);
    if (!tokenRow) return res.status(400).json({ error: '无效的日常贴纸 token' });
    if (tokenRow.status !== 'active' || tokenRow.persona_status !== 'active') {
      return res.status(400).json({ error: '该贴纸暂不可绑定' });
    }
    if (tokenRow.user_id && tokenRow.user_id !== req.user.id) {
      return res.status(409).json({ error: '该贴纸已经绑定到其他账号' });
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
        note: '用户绑定日常贴纸资产',
      });
    }
    saveDb();
    res.json({ success: true, token_id: tokenRow.id, already_bound: tokenRow.user_id === req.user.id });
  } catch (error) {
    console.error('Bind daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/unbind-token', authRequired, async (req, res) => {
  try {
    const db = await getDb();
    const tokenId = cleanString(req.body?.token_id);
    if (!tokenId) return res.status(400).json({ error: 'token_id is required' });
    const tokenRow = resultToObjects(db.exec('SELECT * FROM daily_sticker_tokens WHERE id = ? LIMIT 1', [tokenId]))[0] || null;
    if (!tokenRow) return res.status(404).json({ error: '贴纸资产不存在' });
    if (tokenRow.user_id !== req.user.id) return res.status(403).json({ error: '无权操作该贴纸资产' });

    db.run('UPDATE daily_sticker_tokens SET user_id = NULL, unbound_at = CURRENT_TIMESTAMP WHERE id = ?', [tokenId]);
    recordDailyStickerOwnershipEvent(db, {
      tokenId,
      token: tokenRow.token,
      eventType: 'unbind',
      fromUserId: req.user.id,
      actorUserId: req.user.id,
      orderId: tokenRow.external_order_no || null,
      note: '用户解除日常贴纸归属',
    });
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Unbind daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/templates', authRequired, adminOnly, async (_req, res) => {
  try {
    const db = await getDb();
    res.json(resultToObjects(db.exec('SELECT * FROM daily_sticker_templates ORDER BY code ASC')));
  } catch (error) {
    console.error('List daily sticker templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/visual-styles', authRequired, adminOnly, async (_req, res) => {
  try {
    const db = await getDb();
    res.json(resultToObjects(db.exec('SELECT * FROM daily_sticker_visual_styles ORDER BY style_layer ASC, code ASC')));
  } catch (error) {
    console.error('List daily sticker visual styles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', authRequired, adminOnly, async (_req, res) => {
  try {
    const db = await getDb();
    const release_cron = getConfigValue(db, 'daily_sticker_release_cron', '0 8 * * *');
    const release_timezone = getConfigValue(db, 'daily_sticker_release_timezone', 'Asia/Shanghai');
    res.json({
      release_cron,
      release_timezone,
      cron_valid: parseDailyCron(release_cron).valid,
    });
  } catch (error) {
    console.error('Get daily sticker settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', authRequired, adminOnly, async (req, res) => {
  try {
    const releaseCron = cleanString(req.body.release_cron) || '0 8 * * *';
    const releaseTimezone = cleanString(req.body.release_timezone) || 'Asia/Shanghai';
    const parsed = parseDailyCron(releaseCron);
    if (!parsed.valid) {
      return res.status(400).json({ error: '目前仅支持日级 cron，例如 0 8 * * *' });
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
});

router.get('/worlds', authRequired, adminOnly, async (req, res) => {
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
});

router.post('/worlds', authRequired, adminOnly, async (req, res) => {
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
});

router.put('/worlds/:id', authRequired, adminOnly, async (req, res) => {
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
});

router.get('/story-arcs', authRequired, adminOnly, async (req, res) => {
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
});

router.post('/story-arcs', authRequired, adminOnly, async (req, res) => {
  try {
    const worldId = cleanString(req.body.world_id);
    const title = cleanString(req.body.title);
    if (!worldId || !title) return res.status(400).json({ error: 'world_id and title are required' });
    const releaseCron = cleanString(req.body.release_cron) || '0 8 * * *';
    if (!parseDailyCron(releaseCron).valid) return res.status(400).json({ error: '目前仅支持日级 cron，例如 0 8 * * *' });

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
        cleanString(req.body.release_timezone) || 'Asia/Shanghai',
        cleanString(req.body.status) || 'draft',
      ]
    );
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create daily sticker story arc error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/story-arcs/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const releaseCron = cleanString(req.body.release_cron) || '0 8 * * *';
    if (!parseDailyCron(releaseCron).valid) return res.status(400).json({ error: '目前仅支持日级 cron，例如 0 8 * * *' });
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
        cleanString(req.body.release_timezone) || 'Asia/Shanghai',
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
});

router.get('/personas', authRequired, adminOnly, async (_req, res) => {
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
});

router.post('/personas', authRequired, adminOnly, async (req, res) => {
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
});

router.put('/personas/:id', authRequired, adminOnly, async (req, res) => {
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
});

router.delete('/personas/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_personas WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker persona error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/entries', authRequired, adminOnly, async (req, res) => {
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
});

router.post('/entries', authRequired, adminOnly, async (req, res) => {
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
});

router.put('/entries/:id', authRequired, adminOnly, async (req, res) => {
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
});

router.delete('/entries/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_entries WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tokens', authRequired, adminOnly, async (req, res) => {
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
});

router.post('/tokens', authRequired, adminOnly, async (req, res) => {
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
});

router.put('/tokens/:id', authRequired, adminOnly, async (req, res) => {
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
});

router.delete('/tokens/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM daily_sticker_tokens WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete daily sticker token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
