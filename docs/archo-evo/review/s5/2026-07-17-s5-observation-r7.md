# observation r7

- observer: codex
- timestamp: 2026-07-17T04:34:12+08:00
- round: r7
- question: Why did the Mint Studio content list fail to update immediately after login?
- finding: `useMintStudioLibrary` computed `mintedItems` from non-reactive `isLoggedIn()`. While logged out, the computed did not subscribe to `serverMintedItems`, so a post-login fetch could complete without recalculating the visible list.
- evidence: `tapu/src/composables/useMintStudioLibrary.ts`, `tapu/src/events/appEvents.ts`, validation via `npm run check:quality` and `npm run build`.
- impressive_solution: Make login state explicit and reactive in the Studio library composable, and dispatch auth change events on a microtask so page-level success handlers and global listeners settle in a stable order.

- observer: codex
- timestamp: 2026-07-17T04:34:12+08:00
- round: r7
- question: Why did deleted content return after service restart?
- finding: Official/demo seeds and legacy app content sync used deterministic content ids with upsert semantics. Deleting a `content_instances` row removed the row, but left no system fact saying "this content was intentionally deleted", so seed/sync could recreate it.
- evidence: `tapu/server/services/contentAssets.js`, `tapu/server/services/earphoneGirlSeed.js`, `tapu/server/services/coreCreationSync.js`, `tapu/server/db/index.js`, data check shows `contentInstances: 7`, `oldPayloadRows: []`, `tombstones: 4`.
- impressive_solution: Add a supporting tombstone table `content_instance_deletions`; deletion remains a high-value fact in `events`, while the tombstone prevents bootstrap and legacy sync from resurrecting removed content.

- observer: codex
- timestamp: 2026-07-17T04:34:12+08:00
- round: r7
- question: Is the core-content cleanup still aligned with the 8-object model?
- finding: The visible content library now stays driven by `content_instances`, with old `sourceTable / entries / cards` payload rows removed from the checked-in dev DB and blocked from re-sync after deletion.
- evidence: `tapu/server/data.db`, `tapu/server/routes/mintStudio.js`, `tapu/server/routes/contents.js`, manual sql.js check: `oldPayloadRows: []`.
