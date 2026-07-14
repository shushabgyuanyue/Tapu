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

  return null;
}
