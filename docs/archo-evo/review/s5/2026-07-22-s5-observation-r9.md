# observation r9

- observer: codex
- timestamp: 2026-07-22T18:44:00+08:00
- round: r9
- question: What did the Shop cleanup reveal about retired product data?
- finding: Filtering the customer-facing catalog is not enough; retired or non-manifest IPs can still survive as historical seed or management rows and reappear through old routes or long-running dev server memory.
- evidence: `tapu/server/services/retiredProducts.js`, `tapu/server/db/index.js`, sql.js query after boot showing only `desktop-secret` and `tissue-puppy` in core application/IP definitions and empty legacy `groups / series` rows.
- impressive_solution: Treat active app manifests as the current product source of truth, then remove non-manifest application, IP, content, instance, link and legacy management rows during database boot before saving the local DB.

- observer: codex
- timestamp: 2026-07-22T18:44:00+08:00
- round: r9
- question: Did Mint Space's visual contract match the new official-collage direction?
- finding: The page had already moved toward a fixed collage, but the share card still generated an abstract gradient and the glass copy layer competed with the image.
- evidence: `tapu/src/components/assets/MintSpacePortrait.vue`, `tapu/src/composables/useAssetSpace.ts`, `tapu/src/styles/assetsSpace.css`, `docs/mint-space-collage-assets.md`.
- impressive_solution: Make the official collage the display and share source, keep text as a lighter overlay, and document a future combination-key resource contract instead of hardcoding layout-specific assumptions.

- observer: codex
- timestamp: 2026-07-22T18:44:00+08:00
- round: r9
- question: Which mobile UX seams were still too desktop-shaped?
- finding: Top navigation used horizontal compression on mobile, and Mint Studio's mobile sidebar backdrop could sit above the sidebar, making the shell feel mechanically adapted rather than designed for phone use.
- evidence: `tapu/src/components/NavBar.vue`, `tapu/src/styles/mintStudio.css`, `tapu/src/views/MintStudioPage.vue`, `npm run build`.
