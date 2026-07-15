import { v4 as uuidv4 } from 'uuid';
import { findAppManifest } from '../contracts/appManifests.js';
import { resultToObjects } from './tokens.js';

const ACTIVE_STATUS = 'active';

function stringifyJson(value) {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJson(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeState(row) {
  return {
    ...row,
    strength: Number(row.strength || 0),
    evidence: parseJson(row.evidence_json),
  };
}

export function upsertMeaningfulState(db, params = {}) {
  const stateKey = cleanString(params.stateKey);
  const subjectType = cleanString(params.subjectType);
  const subjectId = cleanString(params.subjectId);
  if (!stateKey || !subjectType || !subjectId) return null;

  const sourceAppCode = cleanString(params.sourceAppCode);
  const sourceObjectId = cleanString(params.sourceObjectId);
  const existing = resultToObjects(db.exec(
    `SELECT id FROM meaningful_states
     WHERE state_key = ? AND subject_type = ? AND subject_id = ?
       AND COALESCE(source_app_code, '') = ?
       AND COALESCE(source_object_id, '') = ?
     LIMIT 1`,
    [stateKey, subjectType, subjectId, sourceAppCode, sourceObjectId]
  ))[0] || null;

  const values = [
    params.subjectToken || null,
    sourceAppCode || null,
    params.sourceObjectType || null,
    sourceObjectId || null,
    params.sourceObjectLabel || null,
    params.category || null,
    Number(params.strength || 1),
    stringifyJson(params.evidence),
    params.status || ACTIVE_STATUS,
    params.expiresAt || null,
  ];

  if (existing) {
    db.run(
      `UPDATE meaningful_states
       SET subject_token = ?, source_app_code = ?, source_object_type = ?, source_object_id = ?,
           source_object_label = ?, category = ?, strength = ?, evidence_json = ?, status = ?,
           expires_at = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [...values, existing.id]
    );
    return existing.id;
  }

  const id = params.id || uuidv4();
  db.run(
    `INSERT INTO meaningful_states
     (id, state_key, subject_type, subject_id, subject_token, source_app_code, source_object_type,
      source_object_id, source_object_label, category, strength, evidence_json, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, stateKey, subjectType, subjectId, ...values]
  );
  return id;
}

function countRecentEvents(db, { appCode, eventTypes = [], token, userId, days = 7 }) {
  const conditions = ['created_at >= datetime(CURRENT_TIMESTAMP, ?)'];
  const params = [`-${days} days`];
  if (appCode) {
    conditions.push('app_code = ?');
    params.push(appCode);
  }
  if (eventTypes.length) {
    conditions.push(`event_type IN (${eventTypes.map(() => '?').join(', ')})`);
    params.push(...eventTypes);
  }
  if (userId) {
    conditions.push('user_id = ?');
    params.push(userId);
  } else if (token) {
    conditions.push('token = ?');
    params.push(token);
  }
  const rows = resultToObjects(db.exec(
    `SELECT COUNT(*) as count FROM object_events WHERE ${conditions.join(' AND ')}`,
    params
  ));
  return Number(rows[0]?.count || 0);
}

function upsertForEventSubjects(db, params) {
  const subjects = [];
  if (params.userId) {
    subjects.push({ type: 'account', id: params.userId });
  }
  if (params.objectId) {
    subjects.push({ type: 'object', id: params.objectId });
  }
  if (params.token) {
    subjects.push({ type: 'token', id: params.token });
  }

  for (const subject of subjects) {
    upsertMeaningfulState(db, {
      ...params,
      subjectType: subject.type,
      subjectId: subject.id,
      subjectToken: params.token || null,
    });
  }
}

export function deriveMeaningfulStatesFromObjectEvent(db, event = {}) {
  const appCode = cleanString(event.appCode);
  const token = cleanString(event.token);
  const userId = cleanString(event.userId);
  const objectId = cleanString(event.objectId);
  const eventType = cleanString(event.eventType);

  if (appCode === 'emotion-ip' && ['tap_open', 'emotion_content_tap', 'media_play'].includes(eventType)) {
    const taps7d = countRecentEvents(db, {
      appCode,
      eventTypes: ['tap_open', 'emotion_content_tap', 'media_play'],
      token,
      userId,
      days: 7,
    });
    upsertForEventSubjects(db, {
      stateKey: 'comfort.action_active',
      category: 'comfort',
      strength: Math.max(1, taps7d),
      evidence: { taps_7d: Math.max(1, taps7d), source_event: eventType },
      sourceAppCode: appCode,
      sourceObjectType: event.objectType || 'mint-entity',
      sourceObjectId: objectId || token,
      sourceObjectLabel: event.metadata?.objectName || event.metadata?.groupName || '纸巾小狗',
      token,
      userId,
      objectId,
    });
  }

  if (appCode === 'daily-sticker' && eventType === 'daily_sticker_tap') {
    const taps7d = countRecentEvents(db, {
      appCode,
      eventTypes: ['daily_sticker_tap'],
      token,
      userId,
      days: 7,
    });
    if (taps7d >= 2) {
      upsertForEventSubjects(db, {
        stateKey: 'story.returning_touch',
        category: 'continuity',
        strength: taps7d,
        evidence: { taps_7d: taps7d, source_event: eventType },
        sourceAppCode: appCode,
        sourceObjectType: event.objectType || 'nfc-sticker',
        sourceObjectId: objectId || token,
        sourceObjectLabel: event.metadata?.worldName || event.metadata?.personaName || '手账慢故事',
        token,
        userId,
        objectId,
      });
    }
  }
}

export function getMeaningfulStatesForContext(db, context = {}) {
  const clauses = [];
  const params = [];

  if (context.userId) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('account', context.userId);
  }
  if (context.objectId) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('object', context.objectId);
  }
  if (context.token) {
    clauses.push('(subject_type = ? AND subject_id = ?)');
    params.push('token', context.token);
  }

  if (!clauses.length) return [];

  return resultToObjects(db.exec(
    `SELECT * FROM meaningful_states
     WHERE status = 'active'
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (${clauses.join(' OR ')})
     ORDER BY last_seen_at DESC`,
    params
  )).map(normalizeState);
}

function skillMatches(skill, states) {
  const requiredStates = skill?.trigger?.states || skill?.requiredStates || [];
  if (!requiredStates.length) return false;
  const stateKeys = new Set(states.map(state => state.state_key));
  return requiredStates.every(key => stateKeys.has(key));
}

export function buildRuntimeContextForObject(db, resolvedObject, options = {}) {
  const context = {
    userId: options.userId || resolvedObject?.raw?.user_id || null,
    objectId: resolvedObject?.object?.id || null,
    token: options.token || resolvedObject?.object?.token || null,
    appCode: resolvedObject?.app?.code || options.appCode || null,
  };
  const states = getMeaningfulStatesForContext(db, context);
  const stateMap = new Map();
  for (const state of states) {
    const key = `${state.state_key}:${state.source_app_code || ''}:${state.source_object_id || ''}`;
    const current = stateMap.get(key);
    if (!current || Number(state.strength || 0) > Number(current.strength || 0)) {
      stateMap.set(key, state);
    }
  }
  const uniqueStates = [...stateMap.values()];
  const manifest = findAppManifest(context.appCode);
  const skills = (manifest?.skills || []).filter(skill => skillMatches(skill, uniqueStates));

  return {
    states: uniqueStates.map(state => ({
      key: state.state_key,
      category: state.category,
      strength: state.strength,
      sourceAppCode: state.source_app_code,
      sourceObjectLabel: state.source_object_label,
      evidence: state.evidence,
    })),
    unlockedSkills: skills.map(skill => ({
      key: skill.key,
      label: skill.label,
      effect: skill.effect || {},
    })),
  };
}
