import { v4 as uuidv4 } from 'uuid';

export function recordOwnershipEvent(db, {
  entityId,
  token,
  eventType,
  fromUserId = null,
  toUserId = null,
  actorUserId = null,
  orderId = null,
  note = '',
}) {
  db.run(
    `INSERT INTO entity_ownership_events
      (id, entity_id, token, event_type, from_user_id, to_user_id, actor_user_id, order_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      entityId || null,
      token || null,
      eventType,
      fromUserId || null,
      toUserId || null,
      actorUserId || null,
      orderId || null,
      note || '',
    ]
  );
}
