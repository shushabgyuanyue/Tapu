import { normalizeEntityToken, resultToObjects } from './tokens.js';

function findAnswerBookByToken(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;

  return resultToObjects(db.exec(
    `SELECT t.*, d.name as deck_name, d.subtitle, d.description, d.tone_notes,
            d.theme_color, d.status as deck_status
     FROM answer_book_tokens t
     JOIN answer_book_decks d ON d.id = t.deck_id
     WHERE t.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

function findDailyStickerByToken(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;

  return resultToObjects(db.exec(
    `SELECT t.*, p.name as persona_name, p.object_type, p.tagline,
            p.theme_color as persona_theme_color, p.status as persona_status,
            w.name as world_name, w.premise as world_premise,
            w.theme_color as world_theme_color, w.status as world_status
     FROM daily_sticker_tokens t
     JOIN daily_sticker_personas p ON p.id = t.persona_id
     LEFT JOIN daily_sticker_worlds w ON w.id = t.world_id
     WHERE t.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

function findMomentByToken(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;

  return resultToObjects(db.exec(
    `SELECT m.*, c.name as collection_name, c.slug as collection_slug,
            c.description as collection_description, c.status as collection_status,
            c.theme_color as collection_theme_color
     FROM moment_tokens m
     JOIN content_collections c ON c.id = m.collection_id
     WHERE m.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

function findTravelTrailByToken(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;

  return resultToObjects(db.exec(
    `SELECT t.*, w.intent, w.status as work_status
     FROM travel_trails t
     LEFT JOIN works w ON w.id = t.work_id
     WHERE t.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

function findChecklistByToken(db, rawToken) {
  const token = normalizeEntityToken(rawToken);
  if (!token) return null;

  return resultToObjects(db.exec(
    `SELECT c.*, w.intent, w.status as work_status,
            t.name as template_name, t.scenario as template_scenario
     FROM checklists c
     LEFT JOIN works w ON w.id = c.work_id
     LEFT JOIN check_templates t ON t.id = c.template_id
     WHERE c.token = ? LIMIT 1`,
    [token]
  ))[0] || null;
}

export function resolveObjectByToken(db, rawToken) {
  const answerBook = findAnswerBookByToken(db, rawToken);
  if (answerBook) {
    return {
      object: {
        type: 'nfc-sticker',
        id: answerBook.id,
        tokenId: answerBook.id,
        token: answerBook.token,
        label: answerBook.label,
        status: answerBook.status,
        displayName: answerBook.label || answerBook.deck_name || '答案之书',
        themeColor: answerBook.theme_color || '#2f6f5e',
      },
      app: {
        code: 'answer-book',
        name: '答案之书',
        interactionType: 'tap_to_mindful_answer',
      },
      raw: answerBook,
    };
  }

  const dailySticker = findDailyStickerByToken(db, rawToken);
  if (dailySticker) {
    return {
      object: {
        type: 'nfc-sticker',
        id: dailySticker.id,
        tokenId: dailySticker.id,
        token: dailySticker.token,
        label: dailySticker.label,
        status: dailySticker.status,
        displayName: dailySticker.world_name || dailySticker.persona_name || dailySticker.label || '日常贴纸',
        themeColor: dailySticker.world_theme_color || dailySticker.persona_theme_color || '#ff4fd8',
        objectType: dailySticker.object_type || null,
      },
      app: {
        code: 'daily-sticker',
        name: '日常贴纸',
        interactionType: 'tap_to_slow_story',
      },
      raw: dailySticker,
    };
  }

  const moment = findMomentByToken(db, rawToken);
  if (moment) {
    return {
      object: {
        type: 'nfc-sticker',
        id: moment.id,
        tokenId: moment.id,
        token: moment.token,
        label: moment.object_label || moment.title,
        status: moment.status,
        displayName: moment.title || moment.collection_name || '纪念瞬间',
        themeColor: moment.theme_color || moment.collection_theme_color || '#9a6a2f',
      },
      app: {
        code: 'moment',
        name: '纪念瞬间',
        interactionType: 'tap_to_saved_moment',
      },
      raw: moment,
    };
  }

  const travelTrail = findTravelTrailByToken(db, rawToken);
  if (travelTrail) {
    return {
      object: {
        type: 'nfc-sticker',
        id: travelTrail.id,
        tokenId: travelTrail.id,
        token: travelTrail.token,
        label: travelTrail.object_label || travelTrail.title,
        status: travelTrail.status,
        displayName: travelTrail.title || '旅行轨迹',
        themeColor: travelTrail.theme_color || '#2f6f5e',
      },
      app: {
        code: 'travel-trail',
        name: '旅行轨迹',
        interactionType: 'tap_to_travel_trace',
      },
      raw: travelTrail,
    };
  }

  const checklist = findChecklistByToken(db, rawToken);
  if (checklist) {
    return {
      object: {
        type: 'nfc-sticker',
        id: checklist.id,
        tokenId: checklist.id,
        token: checklist.token,
        label: checklist.object_label || checklist.title,
        status: checklist.status,
        displayName: checklist.title || 'Check 检查',
        themeColor: checklist.theme_color || '#2f6f5e',
      },
      app: {
        code: 'check',
        name: 'Check 检查',
        interactionType: 'tap_to_object_check',
      },
      raw: checklist,
    };
  }

  return null;
}
