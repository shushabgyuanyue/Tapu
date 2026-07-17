# AGENTS.md

This file defines the default working rules for coding agents in this repository.

## Mission

- Build WhatMint as a clean, compact system driven by core domain objects and stable OS capabilities.
- Prefer extending existing patterns over inventing parallel flows.
- Treat engineering governance as part of feature work, not cleanup that happens later.

## First Reads

Before making non-trivial changes, read:

1. `README.md`
2. `DOMAINS.md`
3. `docs/development-standards.md`
4. `docs/engineering-governance.md`
5. `docs/os-app-boundary.md`
6. `docs/route-permission-principles.md`

## Repo Map

- Frontend: `tapu/src`
- Backend: `tapu/server`
- DB schema: `tapu/server/db/index.js`, `tapu/server/db/schema.sql`, `tapu/server/db/core-schema.sql`
- Main user surfaces: `/assets`, `/mint`, `/shop`, `/community/ip/:id`, `/content/:id`, `/play`
- Official console: `/official`

## Core Product Rules

- The project converges toward the core object model:
  - `users`
  - `ip_definitions`
  - `application_definitions`
  - `content_definitions`
  - `ip_instances`
  - `content_instances`
  - `resources`
  - `events`
- Supporting tables are allowed only if they do not become a parallel business truth.
- OS owns identity, permissions, content protocol, events, states, runtime context, skill matching, and Studio shell.
- Apps own voice, ritual, pacing, story expression, and domain-specific experience.
- When old-architecture logic conflicts with the current core object model, replace it with the new core/OS pattern directly. Do not add compatibility shells, fallback branches, or parallel legacy flows unless the user explicitly asks for temporary migration support.

## Development Rules

- If a file is already large, split it during the same change instead of stacking more logic into it.
- If a file exceeds `500` lines, actively evaluate decomposition.
- If a file exceeds `900` lines, do not continue feature stacking unless it is an emergency fix.
- User-facing copy for non-admin surfaces must go into `tapu/src/copy/*`.
- Reuse existing style variables and shared patterns before adding new visual primitives.
- Similar styles appearing in multiple places should be extracted into shared styles or shared tokens.
- Frontend network access must go through `tapu/src/api/*`; do not scatter raw fetch calls.
- New backend routes must follow the current `routePermissions + operation + contract` pattern.
- Do not create parallel admin shells, duplicate route trees, or one-off routing conventions.

## Refactor Preferences

- Split Vue pages into:
  - page shell
  - composables
  - presentational components
  - copy modules
  - external page styles when large
- Split backend route files into:
  - route registration
  - handler modules
  - domain services
- Prefer additive seams over big-bang rewrites.

## Safety Rules

- Backend `server/**/*.js` must stay plain JavaScript, not TypeScript syntax.
- Before deleting legacy structures, verify whether they are still active. If an active legacy path conflicts with the core object model, replace it with the new core/OS path directly instead of preserving compatibility.
- Do not replace a working path with a “cleaner” abstraction unless the current flow is preserved.
- Do not bypass governance checks to get a feature through.

## Definition of Done

Before considering work complete:

- Relevant docs and local patterns have been followed.
- New user-facing copy is extracted correctly.
- New routes/interfaces follow existing permission and contract conventions.
- Large touched files have been reduced or at least not worsened without reason.
- In `tapu/`, run:

```bash
npm run check:quality
npm run build
```

## When Unsure

- Follow `docs/development-standards.md`.
- Prefer the smaller, more reversible change.
- Preserve the OS / app boundary.
- Ask: “Will this reduce future governance work, or create more of it?”
