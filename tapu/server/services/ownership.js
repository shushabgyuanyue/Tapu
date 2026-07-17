import { v4 as uuidv4 } from 'uuid';
import { stringifyJson } from './coreStore.js';

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
    `INSERT INTO events
      (id, event_type, actor_user_id, user_id, ip_instance_id, payload_json, processing_status, processed_at, occurred_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'processed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      `asset.${eventType}`,
      actorUserId || null,
      toUserId || fromUserId || null,
      entityId || null,
      stringifyJson({
        token: token || null,
        from_user_id: fromUserId || null,
        to_user_id: toUserId || null,
        order_id: orderId || null,
        note: note || '',
      }),
    ]
  );
}
