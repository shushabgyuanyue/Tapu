import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db/index.js';
import { cleanString, parseJson } from '../services/contentCollections.js';
import { recordObjectEvent } from '../services/objectEvents.js';
import { resolveObjectByToken } from '../services/objectRegistry.js';
import { adminRoute, registerRoutes, tokenRoute } from '../services/routePermissions.js';
import { buildTapResponse } from '../services/tapRuntime.js';
import { createUniqueToken, normalizeEntityToken, resultToObjects } from '../services/tokens.js';
import { createWork, getWork, updateWork } from '../services/works.js';
import { serverMessages } from '../copy/messages.js';

const router = Router();
const APP_CODE = 'travel-trail';


function normalizeStatus(value, fallback = 'active') {
  const status = cleanString(value || fallback);
  return ['active', 'draft', 'archived'].includes(status) ? status : fallback;
}

function normalizeWorkStatus(value) {
  const status = normalizeStatus(value);
  return status === 'archived' ? 'archived' : (status === 'active' ? 'active' : 'draft');
}

function normalizeJourneyState(value, fallback = 'planning') {
  const state = cleanString(value || fallback);
  return ['planning', 'traveling', 'returned'].includes(state) ? state : fallback;
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function getTrailPlaces(db, trailId) {
  return resultToObjects(db.exec(
    `SELECT *
     FROM travel_trail_places
     WHERE trail_id = ?
     ORDER BY sort_order ASC, created_at ASC`,
    [trailId]
  )).map(row => ({
    ...row,
    metadata: parseJson(row.metadata_json, {}),
  }));
}

function buildTrailRow(db, row) {
  if (!row) return null;
  return {
    ...row,
    metadata: parseJson(row.metadata_json, {}),
    places: getTrailPlaces(db, row.id),
    place_count: row.place_count || 0,
    tap_count: row.tap_count || 0,
  };
}

function getTrail(db, id) {
  const row = resultToObjects(db.exec(
    `SELECT t.*, w.intent, w.version as work_version
     FROM travel_trails t
     LEFT JOIN works w ON w.id = t.work_id
     WHERE t.id = ? LIMIT 1`,
    [id]
  ))[0] || null;
  return buildTrailRow(db, row);
}

function isWithinWorkWindow(work) {
  if (!work) return true;
  const now = new Date();
  if (work.starts_at && new Date(work.starts_at) > now) return false;
  if (work.ends_at && new Date(work.ends_at) < now) return false;
  return true;
}

function nextSortOrder(db, trailId) {
  const row = resultToObjects(db.exec(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM travel_trail_places WHERE trail_id = ?',
    [trailId]
  ))[0];
  return Number(row?.next_order || 0);
}

function insertPlace(db, trailId, rawPlace = {}) {
  const name = cleanString(rawPlace.name || rawPlace.place);
  if (!name) return null;
  const id = uuidv4();
  const sortOrder = Number.isFinite(Number(rawPlace.sort_order))
    ? Number(rawPlace.sort_order)
    : nextSortOrder(db, trailId);
  db.run(
    `INSERT INTO travel_trail_places
     (id, trail_id, name, note, visited_at, lat, lng, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      trailId,
      name,
      cleanString(rawPlace.note) || null,
      cleanString(rawPlace.visited_at) || null,
      parseOptionalNumber(rawPlace.lat),
      parseOptionalNumber(rawPlace.lng),
      sortOrder,
    ]
  );
  return resultToObjects(db.exec('SELECT * FROM travel_trail_places WHERE id = ? LIMIT 1', [id]))[0] || null;
}

function updateTrailWork(db, trail, options = {}) {
  if (!trail?.work_id) return null;
  return updateWork(db, trail.work_id, {
    title: trail.title,
    description: trail.subtitle || '',
    appCode: APP_CODE,
    intent: 'journey',
    status: normalizeWorkStatus(trail.status),
    tokenId: trail.id,
    token: trail.token,
    versionNote: options.versionNote || 'travel-trail-update',
    metadata: {
      objectLabel: trail.object_label || null,
      placeCount: options.placeCount ?? trail.places?.length ?? null,
      lastPlace: options.lastPlace || null,
      nextPlace: options.nextPlace ?? trail.next_place ?? null,
      journeyState: options.journeyState ?? trail.journey_state ?? 'planning',
      lifeQuestion: serverMessages.routes.travelTrail.lifeQuestion,
    },
  });
}

function setNextDestination(db, trailId, raw = {}) {
  const nextPlace = cleanString(raw.next_place || raw.name || raw.place);
  const nextNote = cleanString(raw.next_place_note || raw.note);
  const journeyState = nextPlace ? normalizeJourneyState(raw.journey_state, 'planning') : 'returned';
  db.run(
    `UPDATE travel_trails
     SET next_place = ?, next_place_note = ?, journey_state = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      nextPlace || null,
      nextNote || null,
      journeyState,
      trailId,
    ]
  );
  return getTrail(db, trailId);
}

function confirmReturn(db, trailId, raw = {}) {
  const trail = getTrail(db, trailId);
  const nextPlace = cleanString(raw.name || trail?.next_place);
  if (!trail || !nextPlace) return null;

  const place = insertPlace(db, trailId, {
    name: nextPlace,
    note: cleanString(raw.note) || trail.next_place_note || null,
    visited_at: raw.visited_at,
  });
  if (!place) return null;

  db.run(
    `UPDATE travel_trails
     SET next_place = NULL, next_place_note = NULL, journey_state = 'returned', updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [trailId]
  );

  return { place, trail: getTrail(db, trailId) };
}

router.get('/resolve', async (req, res) => {
  try {
    const db = await getDb();
    const resolvedObject = resolveObjectByToken(db, req.query.key);
    const tokenRow = resolvedObject?.raw;
    if (!tokenRow || resolvedObject.app.code !== APP_CODE) {
      return res.status(400).json({ error: serverMessages.routes.travelTrail.invalidToken });
    }
    if (tokenRow.status !== 'active') {
      return res.status(404).json({ error: serverMessages.routes.travelTrail.inactive });
    }

    const trail = getTrail(db, tokenRow.id);
    const work = tokenRow.work_id ? getWork(db, tokenRow.work_id) : null;
    if (!isWithinWorkWindow(work)) {
      return res.status(403).json({ error: serverMessages.routes.travelTrail.notInWindow });
    }

    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'travel_trail_tap',
      contentId: tokenRow.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        placeCount: trail.places.length,
        nextPlace: trail.next_place || null,
        journeyState: trail.journey_state || 'planning',
      },
    });
    saveDb();

    const tapResponse = buildTapResponse({
      object: resolvedObject.object,
      app: resolvedObject.app,
      content: {
        title: tokenRow.title,
        subtitle: tokenRow.subtitle,
        themeColor: tokenRow.theme_color || '#2f6f5e',
        intent: work?.intent || 'journey',
        intentDefaults: work?.intent_defaults || {},
        blocks: [],
      },
      actions: [
        trail.next_place
          ? { code: 'confirm_return', label: serverMessages.routes.travelTrail.confirmReturn }
          : { code: 'plan_next_stop', label: serverMessages.routes.travelTrail.planNextStop },
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
        token: tokenRow.token,
        title: tokenRow.title,
        object_label: tokenRow.object_label,
      },
      trail,
      places: trail.places,
      ritual: {
        lifeQuestion: serverMessages.routes.travelTrail.lifeQuestion,
        nextPlace: trail.next_place || null,
        nextPlaceNote: trail.next_place_note || null,
        journeyState: trail.journey_state || 'planning',
      },
      work,
    });
  } catch (error) {
    console.error('Resolve travel trail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function listTrails(_req, res) {
  try {
    const db = await getDb();
    const rows = resultToObjects(db.exec(
      `SELECT t.*, w.intent, w.version as work_version,
              COUNT(DISTINCT p.id) as place_count,
              COUNT(DISTINCT e.id) as tap_count
       FROM travel_trails t
       LEFT JOIN works w ON w.id = t.work_id
       LEFT JOIN travel_trail_places p ON p.trail_id = t.id
       LEFT JOIN object_events e ON e.token_id = t.id AND e.app_code = ?
       GROUP BY t.id
       ORDER BY t.updated_at DESC, t.created_at DESC`,
      [APP_CODE]
    ));
    res.json(rows.map(row => buildTrailRow(db, row)));
  } catch (error) {
    console.error('List travel trails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createTrail(req, res) {
  try {
    const title = cleanString(req.body.title);
    if (!title) return res.status(400).json({ error: '请填写旅行轨迹标题' });

    const db = await getDb();
    const id = uuidv4();
    const rawToken = normalizeEntityToken(req.body.token);
    const token = rawToken || createUniqueToken(db, 'travel_trails', 'token', 'travel trail token');
    const existingToken = resultToObjects(db.exec('SELECT id FROM travel_trails WHERE token = ? LIMIT 1', [token]));
    if (existingToken.length) return res.status(400).json({ error: '这个 token 已经存在' });
    const firstPlaceName = cleanString(req.body.first_place || req.body.place);
    const nextPlace = cleanString(req.body.next_place);
    const nextPlaceNote = cleanString(req.body.next_place_note);
    const journeyState = nextPlace ? normalizeJourneyState(req.body.journey_state, 'planning') : 'returned';

    const work = createWork(db, {
      title,
      description: cleanString(req.body.subtitle) || null,
      appCode: APP_CODE,
      intent: 'journey',
      status: normalizeWorkStatus(req.body.status),
      tokenId: id,
      token,
      createdBy: req.user.id,
      metadata: {
        objectLabel: cleanString(req.body.object_label) || null,
        placeCount: firstPlaceName ? 1 : 0,
        firstPlace: firstPlaceName || null,
        nextPlace: nextPlace || null,
        journeyState,
        lifeQuestion: serverMessages.routes.travelTrail.lifeQuestion,
      },
    });

    db.run(
      `INSERT INTO travel_trails
       (id, token, work_id, title, subtitle, object_label, next_place, next_place_note, journey_state, theme_color, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        token,
        work.id,
        title,
        cleanString(req.body.subtitle) || null,
        cleanString(req.body.object_label) || null,
        nextPlace || null,
        nextPlaceNote || null,
        journeyState,
        cleanString(req.body.theme_color) || '#2f6f5e',
        normalizeStatus(req.body.status),
      ]
    );

    if (firstPlaceName) {
      insertPlace(db, id, {
        name: firstPlaceName,
        note: req.body.first_place_note,
        visited_at: req.body.first_visited_at,
      });
    }

    const trail = getTrail(db, id);
    saveDb();
    res.json({ success: true, id, token, work_id: work.id, trail });
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: '旅行轨迹 token 已存在' });
    }
    console.error('Create travel trail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function addTrailPlace(req, res) {
  try {
    const db = await getDb();
    const trail = getTrail(db, req.params.id);
    if (!trail) return res.status(404).json({ error: serverMessages.routes.travelTrail.missingTrail });

    const place = insertPlace(db, trail.id, req.body);
    if (!place) return res.status(400).json({ error: serverMessages.routes.travelTrail.missingPlace });
    const nextTrail = getTrail(db, trail.id);
    updateTrailWork(db, nextTrail, {
      versionNote: 'travel-place-added',
      placeCount: nextTrail.places.length,
      lastPlace: place.name,
    });
    saveDb();
    res.json({ success: true, place, trail: nextTrail });
  } catch (error) {
    console.error('Add travel place error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateTrailNextDestination(req, res) {
  try {
    const db = await getDb();
    const trail = getTrail(db, req.params.id);
    if (!trail) return res.status(404).json({ error: serverMessages.routes.travelTrail.missingTrail });

    const nextTrail = setNextDestination(db, trail.id, req.body);
    updateTrailWork(db, nextTrail, {
      versionNote: 'travel-next-destination-updated',
      placeCount: nextTrail.places.length,
      lastPlace: nextTrail.places.at(-1)?.name || null,
      nextPlace: nextTrail.next_place || null,
      journeyState: nextTrail.journey_state,
    });
    saveDb();
    res.json({ success: true, trail: nextTrail });
  } catch (error) {
    console.error('Update travel next destination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function addPublicTravelPlaceHandler(req, res) {
  try {
    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const work = tokenRow.work_id ? getWork(db, tokenRow.work_id) : null;
    if (!isWithinWorkWindow(work)) {
      return res.status(403).json({ error: serverMessages.routes.travelTrail.notInWindow });
    }

    const place = insertPlace(db, tokenRow.id, req.body);
    if (!place) return res.status(400).json({ error: serverMessages.routes.travelTrail.missingPlaceInput });
    const trail = getTrail(db, tokenRow.id);
    updateTrailWork(db, trail, {
      versionNote: 'travel-place-added-public',
      placeCount: trail.places.length,
      lastPlace: place.name,
    });
    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'travel_place_added',
      contentId: place.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        placeName: place.name,
        placeCount: trail.places.length,
      },
    });
    saveDb();
    res.json({ success: true, place, trail });
  } catch (error) {
    console.error('Add public travel place error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function setPublicTravelNextDestinationHandler(req, res) {
  try {
    const nextPlace = cleanString(req.body.next_place || req.body.name || req.body.place);
    if (!nextPlace) return res.status(400).json({ error: serverMessages.routes.travelTrail.missingNextStop });

    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const work = tokenRow.work_id ? getWork(db, tokenRow.work_id) : null;
    if (!isWithinWorkWindow(work)) {
      return res.status(403).json({ error: serverMessages.routes.travelTrail.notInWindow });
    }

    const trail = setNextDestination(db, tokenRow.id, {
      ...req.body,
      next_place: nextPlace,
      journey_state: 'planning',
    });
    updateTrailWork(db, trail, {
      versionNote: 'travel-next-destination-planned',
      placeCount: trail.places.length,
      lastPlace: trail.places.at(-1)?.name || null,
      nextPlace: trail.next_place || null,
      journeyState: trail.journey_state,
    });
    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'travel_next_destination_set',
      contentId: tokenRow.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        nextPlace: trail.next_place,
        placeCount: trail.places.length,
      },
    });
    saveDb();
    res.json({ success: true, trail });
  } catch (error) {
    console.error('Set public travel next destination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function confirmPublicTravelReturnHandler(req, res) {
  try {
    const { db, resolvedObject, appToken: tokenRow } = req.permission;
    const work = tokenRow.work_id ? getWork(db, tokenRow.work_id) : null;
    if (!isWithinWorkWindow(work)) {
      return res.status(403).json({ error: serverMessages.routes.travelTrail.notInWindow });
    }

    const returned = confirmReturn(db, tokenRow.id, req.body);
    if (!returned) return res.status(400).json({ error: serverMessages.routes.travelTrail.noReturnPending });

    updateTrailWork(db, returned.trail, {
      versionNote: 'travel-return-confirmed',
      placeCount: returned.trail.places.length,
      lastPlace: returned.place.name,
      nextPlace: null,
      journeyState: 'returned',
    });
    recordObjectEvent(db, {
      objectType: resolvedObject.object.type,
      objectId: resolvedObject.object.id,
      tokenId: tokenRow.id,
      token: tokenRow.token,
      appCode: APP_CODE,
      eventType: 'travel_return_confirmed',
      contentId: returned.place.id,
      userAgent: req.headers['user-agent'] || null,
      metadata: {
        placeName: returned.place.name,
        placeCount: returned.trail.places.length,
      },
    });
    saveDb();
    res.json({ success: true, place: returned.place, trail: returned.trail });
  } catch (error) {
    console.error('Confirm travel return error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteTrailPlace(req, res) {
  try {
    const db = await getDb();
    const trail = getTrail(db, req.params.trailId);
    if (!trail) return res.status(404).json({ error: serverMessages.routes.travelTrail.missingTrail });
    db.run('DELETE FROM travel_trail_places WHERE id = ? AND trail_id = ?', [req.params.placeId, req.params.trailId]);
    const nextTrail = getTrail(db, trail.id);
    updateTrailWork(db, nextTrail, {
      versionNote: 'travel-place-deleted',
      placeCount: nextTrail.places.length,
      lastPlace: nextTrail.places.at(-1)?.name || null,
    });
    saveDb();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete travel place error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

registerRoutes(router, [
  adminRoute('get', '/trails', listTrails),
  adminRoute('post', '/trails', createTrail),
  adminRoute('post', '/trails/:id/places', addTrailPlace),
  adminRoute('put', '/trails/:id/next-destination', updateTrailNextDestination),
  adminRoute('delete', '/trails/:trailId/places/:placeId', deleteTrailPlace),
  tokenRoute('post', '/places', APP_CODE, addPublicTravelPlaceHandler),
  tokenRoute('post', '/next-destination', APP_CODE, setPublicTravelNextDestinationHandler),
  tokenRoute('post', '/return', APP_CODE, confirmPublicTravelReturnHandler),
]);

export default router;
