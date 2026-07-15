export default {
  id: '0001_content_operation_states',
  title: 'Add meaningful state storage for Content Operation',
  status: 'active',
  description: 'Introduces the meaningful_states table used by WhatMint OS to store product-level states derived from object events.',
  appliesToEmptyDatabase: true,
  irreversible: false,
  up(db) {
    db.run(`CREATE TABLE IF NOT EXISTS meaningful_states (
      id TEXT PRIMARY KEY,
      state_key TEXT NOT NULL,
      subject_type TEXT NOT NULL CHECK(subject_type IN ('account', 'object', 'token', 'relationship')),
      subject_id TEXT NOT NULL,
      subject_token TEXT,
      source_app_code TEXT,
      source_object_type TEXT,
      source_object_id TEXT DEFAULT '',
      source_object_label TEXT,
      category TEXT,
      strength REAL DEFAULT 1,
      evidence_json TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'expired')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_subject ON meaningful_states(subject_type, subject_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_key ON meaningful_states(state_key)');
    db.run('CREATE INDEX IF NOT EXISTS idx_meaningful_states_source ON meaningful_states(source_app_code, source_object_id)');
  },
};
