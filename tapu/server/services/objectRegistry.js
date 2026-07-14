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

  return null;
}
