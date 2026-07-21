import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { adminRoute, registerRoutes } from '../services/routePermissions.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import { recordObjectOperation, runOperationPipeline } from '../services/contentOperation.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { buildAppRuntimeContext } from '../services/appAdapters.js';
import { buildContentBlocksForAnswerCard, buildTapResponse } from '../services/tapRuntime.js';
import { serverMessages } from '../copy/messages.js';
import { syncAnswerBookDeckContent } from '../services/coreCreationSync.js';

const router = Router();


function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePositiveInt(value, fallback) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function getDeck(db, deckId) {
  return resultToObjects(db.exec('SELECT * FROM answer_book_decks WHERE id = ? LIMIT 1', [deckId]))[0] || null;
}

function chooseCard(db, deckId, excludeCardId) {
  const params = [deckId];
  let excludeSql = '';
  if (excludeCardId) {
    excludeSql = 'AND id != ?';
    params.push(excludeCardId);
  }

  let cards = resultToObjects(db.exec(
    `SELECT * FROM answer_book_cards
     WHERE deck_id = ? AND status = 'active' ${excludeSql}
     ORDER BY RANDOM() LIMIT 1`,
    params
  ));

  if (cards.length === 0 && excludeCardId) {
    cards = resultToObjects(db.exec(
      `SELECT * FROM answer_book_cards
       WHERE deck_id = ? AND status = 'active'
       ORDER BY RANDOM() LIMIT 1`,
      [deckId]
    ));
  }

  return cards[0] || null;
}

function recordDraw(db, tokenRow, card, req) {
  db.run(
    `INSERT INTO answer_book_draw_events
     (token_id, deck_id, card_id, user_agent)
     VALUES (?, ?, ?, ?)`,
    [tokenRow.id, tokenRow.deck_id, card?.id || null, req.headers['user-agent'] || null]
  );
}

router.get('/resolve', async (req, res) => {
  try {
    const db = await getDb();
    const resolvedObject = resolveObjectByToken(db, req.query.key);
    const tokenRow = resolvedObject?.raw;
    if (!tokenRow) return res.status(400).json({ error: serverMessages.routes.answerBook.invalidToken });
    if (tokenRow.status !== 'active' || tokenRow.deck_status !== 'active') {
      return res.status(404).json({ error: serverMessages.routes.answerBook.inactive });
    }

    const card = chooseCard(db, tokenRow.deck_id, cleanString(req.query.exclude));
    if (!card) return res.status(404).json({ error: serverMessages.routes.answerBook.emptyDeck });

    recordDraw(db, tokenRow, card, req);
    const operationId = recordObjectOperation(db, {
      operationType: 'object.touch',
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: resolvedObject.app.code,
      contentId: card.id,
      userId: req.user?.id || tokenRow.user_id || null,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        deckId: tokenRow.deck_id,
        cardId: card.id,
        excludedCardId: cleanString(req.query.exclude) || null,
      },
    });
    runOperationPipeline(db, { operationIds: [operationId] });
    saveDb();
    const runtimeContext = buildAppRuntimeContext(db, resolvedObject, {
      userId: req.user?.id || tokenRow.user_id || null,
      token: tokenRow.token,
    });

    const tapResponse = buildTapResponse({
      object: resolvedObject.object,
      app: resolvedObject.app,
      content: {
        title: tokenRow.deck_name,
        subtitle: tokenRow.subtitle,
        description: tokenRow.description,
        toneNotes: tokenRow.tone_notes,
        themeColor: tokenRow.theme_color,
        blocks: buildContentBlocksForAnswerCard(card),
      },
      actions: [
        { code: 'draw_again', label: serverMessages.routes.answerBook.drawAgain },
        { code: 'copy_answer', label: serverMessages.routes.answerBook.copyAnswer },
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
      },
      deck: {
        id: tokenRow.deck_id,
        name: tokenRow.deck_name,
        subtitle: tokenRow.subtitle,
        description: tokenRow.description,
        tone_notes: tokenRow.tone_notes,
        theme_color: tokenRow.theme_color,
      },
      card,
      runtime_context: runtimeContext,
    });
  } catch (error) {
    console.error('Resolve answer book error:', error);
    res.status(500).json({ error: serverMessages.routes.common.internalServerError });
  }
});

async function listDecks(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT d.*,
              COUNT(DISTINCT c.id) as card_count,
              COUNT(DISTINCT t.id) as token_count
       FROM answer_book_decks d
       LEFT JOIN answer_book_cards c ON c.deck_id = d.id
       LEFT JOIN answer_book_tokens t ON t.deck_id = d.id
       GROUP BY d.id
       ORDER BY d.created_at DESC`
    ));
    res.json(rows);
  } catch (error) {
    console.error('List answer book decks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createDeck(req, res) {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写牌组名称' });

    const db = await getDb();
    const id = uuidv4();
    db.run(
      `INSERT INTO answer_book_decks
       (id, name, subtitle, description, tone_notes, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        cleanString(req.body.subtitle) || null,
        cleanString(req.body.description) || null,
        cleanString(req.body.tone_notes) || null,
        cleanString(req.body.theme_color) || '#2f6f5e',
        cleanString(req.body.status) || 'active',
      ]
    );
    syncAnswerBookDeckContent(db, id);
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create answer book deck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateDeck(req, res) {
  try {
    const name = cleanString(req.body.name);
    if (!name) return res.status(400).json({ error: '请填写牌组名称' });

    const db = await getDb();
    const existing = resultToObjects(db.exec(
      'SELECT deck_id FROM answer_book_cards WHERE id = ? LIMIT 1',
      [req.params.id]
    ))[0] || null;
    db.run(
      `UPDATE answer_book_decks
       SET name = ?, subtitle = ?, description = ?, tone_notes = ?, theme_color = ?, status = ?
       WHERE id = ?`,
      [
        name,
        cleanString(req.body.subtitle) || null,
        cleanString(req.body.description) || null,
        cleanString(req.body.tone_notes) || null,
        cleanString(req.body.theme_color) || '#2f6f5e',
        cleanString(req.body.status) || 'active',
        req.params.id,
      ]
    );
    syncAnswerBookDeckContent(db, req.params.id);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update answer book deck error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listCards(req, res) {
  try {
    const db = await getDb();
    const deckId = cleanString(req.query.deck_id);
    const params = [];
    const where = deckId ? 'WHERE c.deck_id = ?' : '';
    if (deckId) params.push(deckId);
    const rows = resultToObjects(db.exec(
      `SELECT c.*, d.name as deck_name
       FROM answer_book_cards c
       LEFT JOIN answer_book_decks d ON d.id = c.deck_id
       ${where}
       ORDER BY c.sort_order ASC, c.created_at ASC`,
      params
    ));
    res.json(rows);
  } catch (error) {
    console.error('List answer book cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createCard(req, res) {
  try {
    const deckId = cleanString(req.body.deck_id);
    const answer = cleanString(req.body.answer);
    if (!deckId || !answer) return res.status(400).json({ error: '请选择牌组并填写主句' });

    const db = await getDb();
    if (!getDeck(db, deckId)) return res.status(404).json({ error: '牌组不存在' });

    const id = uuidv4();
    db.run(
      `INSERT INTO answer_book_cards
       (id, deck_id, answer, response, action, tag, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        deckId,
        answer,
        cleanString(req.body.response) || null,
        cleanString(req.body.action) || null,
        cleanString(req.body.tag) || null,
        cleanString(req.body.status) || 'active',
        Number(req.body.sort_order) || 0,
      ]
    );
    if (existing?.deck_id && existing.deck_id !== deckId) syncAnswerBookDeckContent(db, existing.deck_id);
    syncAnswerBookDeckContent(db, deckId);
    saveDb();
    res.json({ success: true, id });
  } catch (error) {
    console.error('Create answer book card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateCard(req, res) {
  try {
    const deckId = cleanString(req.body.deck_id);
    const answer = cleanString(req.body.answer);
    if (!deckId || !answer) return res.status(400).json({ error: '请选择牌组并填写主句' });

    const db = await getDb();
    db.run(
      `UPDATE answer_book_cards
       SET deck_id = ?, answer = ?, response = ?, action = ?, tag = ?, status = ?, sort_order = ?
       WHERE id = ?`,
      [
        deckId,
        answer,
        cleanString(req.body.response) || null,
        cleanString(req.body.action) || null,
        cleanString(req.body.tag) || null,
        cleanString(req.body.status) || 'active',
        Number(req.body.sort_order) || 0,
        req.params.id,
      ]
    );
    syncAnswerBookDeckContent(db, deckId);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Update answer book card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteCard(req, res) {
  try {
    const db = await getDb();
    const row = resultToObjects(db.exec(
      'SELECT deck_id FROM answer_book_cards WHERE id = ? LIMIT 1',
      [req.params.id]
    ))[0] || null;
    db.run('DELETE FROM answer_book_cards WHERE id = ?', [req.params.id]);
    if (row?.deck_id) syncAnswerBookDeckContent(db, row.deck_id);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete answer book card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listTokens(req, res) {
  try {
    const db = await getDb();
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.page_size, 50);
    const q = cleanString(req.query.q);
    const conditions = [];
    const params = [];
    if (req.query.deck_id) {
      conditions.push('t.deck_id = ?');
      params.push(req.query.deck_id);
    }
    if (q) {
      conditions.push('(t.token LIKE ? OR t.label LIKE ? OR d.name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const fromSql = `FROM answer_book_tokens t LEFT JOIN answer_book_decks d ON d.id = t.deck_id ${where}`;
    const totalRows = resultToObjects(db.exec(`SELECT COUNT(*) as total ${fromSql}`, params));
    const total = totalRows[0]?.total || 0;
    const rows = resultToObjects(db.exec(
      `SELECT t.*, d.name as deck_name
       ${fromSql}
       ORDER BY t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    ));
    res.json({ items: rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    console.error('List answer book tokens error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createTokens(req, res) {
  try {
    const deckId = cleanString(req.body.deck_id);
    if (!deckId) return res.status(400).json({ error: '请选择牌组' });

    const db = await getDb();
    if (!getDeck(db, deckId)) return res.status(404).json({ error: '牌组不存在' });

    const count = Math.min(parsePositiveInt(req.body.count, 1), 100);
    const tokens = [];
    const customToken = normalizeEntityToken(req.body.token);
    if (customToken && count > 1) return res.status(400).json({ error: '批量生成时不能指定固定 token' });

    for (let i = 0; i < count; i++) {
      const id = uuidv4();
      const token = customToken || createUniqueToken(db, 'answer_book_tokens', 'token', 'answer book token');
      const label = cleanString(req.body.label) || null;
      const finalLabel = count > 1 && label ? `${label}-${i + 1}` : label;
      db.run(
        `INSERT INTO answer_book_tokens
         (id, deck_id, token, label, status)
         VALUES (?, ?, ?, ?, ?)`,
        [id, deckId, token, finalLabel, cleanString(req.body.status) || 'active']
      );
      tokens.push({ id, token, label: finalLabel });
    }
    syncAnswerBookDeckContent(db, deckId);
    saveDb();
    res.json({ success: true, tokens });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'token 已存在' });
    }
    console.error('Create answer book token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteToken(req, res) {
  try {
    const db = await getDb();
    const row = resultToObjects(db.exec(
      'SELECT deck_id FROM answer_book_tokens WHERE id = ? LIMIT 1',
      [req.params.id]
    ))[0] || null;
    db.run('DELETE FROM answer_book_tokens WHERE id = ?', [req.params.id]);
    if (row?.deck_id) syncAnswerBookDeckContent(db, row.deck_id);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete answer book token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/decks', listDecks),
  adminRoute('post', '/decks', createDeck),
  adminRoute('put', '/decks/:id', updateDeck),
  adminRoute('get', '/cards', listCards),
  adminRoute('post', '/cards', createCard),
  adminRoute('put', '/cards/:id', updateCard),
  adminRoute('delete', '/cards/:id', deleteCard),
  adminRoute('get', '/tokens', listTokens),
  adminRoute('post', '/tokens', createTokens),
  adminRoute('delete', '/tokens/:id', deleteToken),
]);

export default router;
