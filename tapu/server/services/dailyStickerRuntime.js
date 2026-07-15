import { v4 as uuidv4 } from 'uuid';
import { resultToObjects } from './tokens.js';

export const DEFAULT_DAILY_STICKER_RELEASE_CRON = '*/1 * * * *';
export const DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE = 'Asia/Shanghai';


export function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

export function parseOptionalInt(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getConfigValue(db, key, fallback) {
  const rows = resultToObjects(db.exec('SELECT value FROM site_config WHERE key = ? LIMIT 1', [key]));
  return rows[0]?.value || fallback;
}

export function setConfigValue(db, key, value) {
  const existing = resultToObjects(db.exec('SELECT key FROM site_config WHERE key = ? LIMIT 1', [key]));
  if (existing.length > 0) {
    db.run('UPDATE site_config SET value = ? WHERE key = ?', [String(value), key]);
  } else {
    db.run('INSERT INTO site_config (key, value) VALUES (?, ?)', [key, String(value)]);
  }
}

export function parseReleaseCron(cron) {
  const parts = String(cron || '').trim().split(/\s+/);
  if (parts.length !== 5) return { valid: false, mode: 'daily', minute: 0, hour: 8 };
  const [minuteExpr, hourExpr, dayExpr, monthExpr, weekExpr] = parts;
  const isEveryDay = dayExpr === '*' && monthExpr === '*' && weekExpr === '*';
  if (!isEveryDay) return { valid: false, mode: 'daily', minute: 0, hour: 8 };

  if (hourExpr === '*') {
    if (minuteExpr === '*') {
      return { valid: true, mode: 'minute_interval', intervalMinutes: 1 };
    }
    const intervalMatch = minuteExpr.match(/^(?:\*|0)\/([1-9]\d*)$/);
    if (intervalMatch) {
      const intervalMinutes = Number(intervalMatch[1]);
      if (Number.isInteger(intervalMinutes) && intervalMinutes >= 1 && intervalMinutes <= 59) {
        return { valid: true, mode: 'minute_interval', intervalMinutes };
      }
    }
    return { valid: false, mode: 'minute_interval', intervalMinutes: 1 };
  }

  const minute = Number(minuteExpr);
  const hour = Number(hourExpr);
  if (!Number.isInteger(minute) || !Number.isInteger(hour) || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return { valid: false, mode: 'daily', minute: 0, hour: 8 };
  }
  return { valid: true, mode: 'daily', minute, hour };
}

export function validReleaseCronOrDefault(cron) {
  const parsed = parseReleaseCron(cron);
  return parsed.valid ? { cron, parsed } : { cron: DEFAULT_DAILY_STICKER_RELEASE_CRON, parsed: parseReleaseCron(DEFAULT_DAILY_STICKER_RELEASE_CRON) };
}

export function localParts(date, timeZone) {
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
    hour: Number(parts.hour) === 24 ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function dateKeyFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function previousDateKey(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function partsFromDateKey(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 0,
    minute: 0,
  };
}

export function localMinuteSerial(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour || 0, parts.minute || 0) / (60 * 1000));
}

export function minutesSinceLocalDate(dateKey, currentParts) {
  const startParts = partsFromDateKey(dateKey);
  if (!startParts || !currentParts) return null;
  return localMinuteSerial(currentParts) - localMinuteSerial(startParts);
}

export function buildReleaseContext({ cron, timeZone, dateOverride }) {
  const safe = validReleaseCronOrDefault(cron || DEFAULT_DAILY_STICKER_RELEASE_CRON);
  const parsed = safe.parsed;
  const timezone = timeZone || DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE;
  const parts = partsFromDateKey(dateOverride) || localParts(new Date(), timezone);
  const currentKey = dateKeyFromParts(parts);

  if (parsed.mode === 'minute_interval') {
    return {
      cron: safe.cron,
      cron_mode: parsed.mode,
      interval_minutes: parsed.intervalMinutes,
      timezone,
      date_key: currentKey,
      local_parts: parts,
      slot_index: Math.floor(localMinuteSerial(parts) / parsed.intervalMinutes),
    };
  }

  let dateKey = currentKey;
  if (!dateOverride && (parts.hour < parsed.hour || (parts.hour === parsed.hour && parts.minute < parsed.minute))) {
    dateKey = previousDateKey(currentKey);
  }
  return {
    cron: safe.cron,
    cron_mode: parsed.mode,
    release_minute: parsed.minute,
    release_hour: parsed.hour,
    timezone,
    date_key: dateKey,
    local_parts: parts,
  };
}

export function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeJsonField(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  return JSON.stringify(value);
}

export function daysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function normalizeEntryAssets(rawAssets) {
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

export function hasRenderableEntryContent(req, body) {
  return Boolean(
    body ||
    cleanString(req.body.title) ||
    cleanString(req.body.markdown_source) ||
    normalizeJsonField(req.body.content_json) ||
    normalizeEntryAssets(req.body.assets).length > 0
  );
}

export function getPersona(db, personaId) {
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_personas WHERE id = ? LIMIT 1', [personaId]))[0] || null;
}

export function getWorld(db, worldId) {
  if (!worldId) return null;
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_worlds WHERE id = ? LIMIT 1', [worldId]))[0] || null;
}

export function getStoryArc(db, storyArcId) {
  if (!storyArcId) return null;
  return resultToObjects(db.exec('SELECT * FROM daily_sticker_story_arcs WHERE id = ? LIMIT 1', [storyArcId]))[0] || null;
}

export function getEntryAssets(db, entryId) {
  if (!entryId) return [];
  return resultToObjects(db.exec(
    `SELECT * FROM daily_sticker_entry_assets
     WHERE entry_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [entryId]
  ));
}

export function replaceEntryAssets(db, entryId, rawAssets) {
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

export function getEntryForDate(db, personaId, entryDate) {
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

export function resolveStoryProgress(tokenRow, releaseContext, queryDay, storyArc) {
  const explicitDay = parseOptionalInt(queryDay);
  if (explicitDay && explicitDay > 0) {
    return { raw_day: explicitDay, lookup_day: explicitDay, current_day: explicitDay };
  }
  if (tokenRow.progress_mode === 'story_day' && tokenRow.story_start_date) {
    const diff = releaseContext.cron_mode === 'minute_interval'
      ? minutesSinceLocalDate(tokenRow.story_start_date, releaseContext.local_parts)
      : daysBetween(tokenRow.story_start_date, releaseContext.date_key);
    if (diff === null) return null;
    const interval = releaseContext.cron_mode === 'minute_interval' ? releaseContext.interval_minutes || 1 : 1;
    const rawDay = Math.max(1, Math.floor(diff / interval) + 1 + (Number(tokenRow.day_offset) || 0));
    const totalDays = Number(storyArc?.total_days);
    const shouldLoop = releaseContext.cron_mode === 'minute_interval' && Number.isInteger(totalDays) && totalDays > 0;
    const lookupDay = shouldLoop ? ((rawDay - 1) % totalDays) + 1 : rawDay;
    return { raw_day: rawDay, lookup_day: lookupDay, current_day: lookupDay };
  }
  return null;
}

export function getEntryForToken(db, tokenRow, releaseContext, queryDay, storyArc) {
  const published = "status = 'published'";
  const entryDate = releaseContext.date_key;
  if (tokenRow.story_arc_id) {
    const storyProgress = resolveStoryProgress(tokenRow, releaseContext, queryDay, storyArc);
    if (storyProgress?.lookup_day) {
      const byDay = resultToObjects(db.exec(
        `SELECT * FROM daily_sticker_entries
         WHERE story_arc_id = ? AND day_index = ? AND ${published}
         LIMIT 1`,
        [tokenRow.story_arc_id, storyProgress.lookup_day]
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

export function recordDailyStickerOwnershipEvent(db, params) {
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

export function buildStickerAsset(db, tokenRow) {
  const persona = getPersona(db, tokenRow.persona_id);
  const world = getWorld(db, tokenRow.world_id);
  const storyArc = getStoryArc(db, tokenRow.story_arc_id);
  const defaultCron = getConfigValue(db, 'daily_sticker_release_cron', DEFAULT_DAILY_STICKER_RELEASE_CRON);
  const defaultTimezone = getConfigValue(db, 'daily_sticker_release_timezone', DEFAULT_DAILY_STICKER_RELEASE_TIMEZONE);
  const effectiveCron = storyArc?.release_cron || defaultCron;
  const effectiveTimezone = storyArc?.release_timezone || defaultTimezone;
  const releaseContext = buildReleaseContext({ cron: effectiveCron, timeZone: effectiveTimezone });
  const entry = getEntryForToken(db, tokenRow, releaseContext, undefined, storyArc);
  const progress = resolveStoryProgress(tokenRow, releaseContext, undefined, storyArc);

  return {
    ...tokenRow,
    persona,
    world,
    story_arc: storyArc,
    current_entry: entry ? { ...entry, assets: getEntryAssets(db, entry.id) } : null,
    current_day: progress?.current_day || entry?.day_index || null,
    current_story_day_raw: progress?.raw_day || null,
    release: releaseContext,
  };
}

export function buildEntryParams(req, id, personaId, body, entryDate, assets) {
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
