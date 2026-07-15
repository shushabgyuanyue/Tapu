# Retro Notes: Codex r6

Date: 2026-07-16
Strategy: S5

## Project Situation

- This round completed a broad mainline sprint around WhatMint OS maturity, Mint Studio usability, interface contracts, engineering governance, and the first visible Content Operation sample.
- The most important architectural shift is that WhatMint OS is no longer only a set of shared helpers. It now has enforceable seams: route permissions, operation contracts, app manifests, content blocks, object events, meaningful states, runtime context, and app-level experience adapters.
- The user direction became clearer: future value depends on distinguishing OS capabilities from app expression, so new light apps can join the ecosystem quickly without turning the product into a generic platform UI.

## Evidence

- Added engineering governance checks for encoding, server syntax, permissions, database governance, manifests, contract tests, and file size reporting.
- Added or strengthened OS-level contracts:
  - `server/contracts/appManifests.js`
  - `server/contracts/operations.js`
  - `server/contracts/routePermissionMap.js`
  - `server/contracts/criticalPermissionFlows.js`
- Added Content Operation MVP:
  - `meaningful_states`
  - `server/services/contentOperation.js`
  - `server/services/dailyStickerExperience.js`
  - manifest-level `producesStates` and `skills`
- Added visible sample behavior:
  - Daily Sticker earphones sample unlocks `guest_character_story`
  - First-screen relationship notice shows that `纸巾小狗` has affected the earphones story world.
- Added boundary documents:
  - `docs/content-operation.md`
  - `docs/os-app-boundary.md`
  - `docs/interface-contracts.md`
  - `docs/engineering-governance.md`
  - `docs/design-language.md`

## Validation

- `npm run build`
- `npm run check:quality`
- `npm run test:contracts`
- `npm run check:manifests`
- Real API verification for `/api/daily-stickers/resolve?key=9f1d7a4e6b8c4f21a3d5e7c9b0a2f416`
- Mobile-sized Chrome screenshot verified the sample relationship notice is visible on first screen.
- `git diff --check` reports only line-ending normalization warnings.

## What Worked

- Splitting Daily Sticker-specific crossover content into `dailyStickerExperience.js` corrected an important boundary issue: OS matches states and skills; the app decides how the unlocked skill becomes visible.
- Manifest checks now make app ecosystem declarations enforceable instead of aspirational.
- Contract tests now cover the expensive Content Operation chain: event -> state -> skill -> visible block.
- The sample is small, but it proves the ecosystem loop without requiring a heavy rules engine.

## What Remains Risky

- The working tree accumulated many changes before final commit. This is acceptable for this sprint but should not become the default workflow.
- Some large files remain over soft or hard size thresholds, especially `AssetsPage.vue` and official management pages.
- `server/data.db` is still a checked-in sql.js database used for local demo state. This is useful for demos but should be handled carefully if production data ever enters the repo.
- Line-ending warnings remain noisy on Windows, though encoding checks now pass.

## Recommendation For Next Round

- Do not add another OS layer immediately.
- If work continues on platform maturity, prioritize a small Content Operation debug panel that shows states, unlocked skills, and trigger reasons for a token.
- If work returns to product expansion, build the next light app using the new adapter mindset from the start.
- Treat every new app as a test of the OS/App boundary: OS handles identity, permission, runtime, content protocol, events, states, and skills; the app owns its ritual and expression.

## [SELF-CONSTRAINT]

- Do not put app-specific story, character voice, or visual rhythm inside OS services.
- Any new manifest `producesStates` or `skills` declaration must be backed by either visible UI behavior or a contract test.
- When a new app needs cross-app behavior, first try `object_events -> meaningful_states -> runtimeContext -> app adapter` before adding direct table reads.
- Avoid further broad governance sprints until there is either a broken quality signal or a new light app that proves a missing seam.
