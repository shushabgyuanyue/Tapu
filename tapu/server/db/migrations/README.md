# Database Migrations

This directory is the forward path for schema changes. The current project still boots from `schema.sql` and `db/index.js`; `0000_baseline.js` marks that state so future changes can be added incrementally.

Rules:

- Use monotonically increasing ids: `0001_add_works_intent.js`.
- Export a default object with `id`, `title`, `description`, `up()`, and optional `down()`.
- New tables or columns should be introduced here first, then wired into bootstrap if needed while there is no legacy data.
- Seed data does not belong here; put it under `server/db/seeds`.
