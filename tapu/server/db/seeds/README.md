# Database Seeds

This directory is the forward path for deterministic default data and test fixtures.

Rules:

- Use monotonically increasing ids for ordered seeds: `0001_add_check_templates.js`.
- Export a default object with `id`, `title`, `description`, and `apply()`.
- Keep schema changes in `server/db/migrations`; seeds should only create or update data.
- Prefer idempotent seeds so local development and tests can run them repeatedly.
- App defaults, templates, and demo fixtures should be documented here instead of being hidden inside route handlers.
