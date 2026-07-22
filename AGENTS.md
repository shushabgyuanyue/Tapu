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
7. `docs/customer-facing-experience-plan.md`
8. `docs/design-system-governance.md`

## Repo Map

- Frontend: `tapu/src`
- Backend: `tapu/server`
- DB schema: `tapu/server/db/index.js`, `tapu/server/db/schema.sql`, `tapu/server/db/core-schema.sql`
- Main user surfaces: `/assets`, `/mint`, `/shop`, `/shop/ip/:id`, `/content/:id`, `/play`
- Official console: `/official`

## Core Product Rules

- WhatMint 对客北极星是：现实世界 UI，让日常物品在关键生活场景中获得数字表达，补上它原本想表达却无法表达的部分。
- 当前阶段是封闭自营 App，不按开放第三方平台设计；联名先作为场景 IP 的视觉、话术和资源表达接入。
- 当前应用建模默认按 `IP + 应用 + 实体入口 + 场景` 推导，一个 IP 默认绑定一个应用、一个实体入口和一个具体场景；不要做大而全 IP，也不要为了世界观叙事预设 IP 间关系或 Space 首页故事模块。
- `Mint Space` 是拥有后的默认目的地；未拥有用户优先走首页、邀请存在、NFC 体验和创作示例，不强行教育 Space。
- IP 对客表达为“存在 / 伙伴”，购买对客表达为“邀请”，资产管理能力应下沉到伙伴详情或二级操作。
- `/assets` 技术路径可以保留，但用户侧页面和文案应优先表达为 `Mint Space`，不得回退为资产仓库、展馆、展品列表。
- 首页是现实世界 UI 入口，商城 / IP 详情是邀请入口，NFC 触碰页是线下冷启动入口，Mint Studio 是赋予物体新表达的创作入口。
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
- Do not add a new core table just to represent Mint Space; it is a user-facing aggregation of core objects and OS capabilities.
- When old-architecture logic conflicts with the current core object model, replace it with the new core/OS pattern directly. Do not add compatibility shells, fallback branches, or parallel legacy flows unless the user explicitly asks for temporary migration support.
- Legacy light apps that were explicitly retired must be removed from active manifests, routes, seeds, Studio profiles, official UI, tests, and app-specific tables. Do not keep frozen placeholder shells for retired apps; future versions must reconnect through the new core OS pattern from scratch.

## Development Rules

- If a file is already large, split it during the same change instead of stacking more logic into it.
- If a file exceeds `500` lines, actively evaluate decomposition.
- If a file exceeds `900` lines, do not continue feature stacking unless it is an emergency fix.
- User-facing copy for non-admin surfaces must go into `tapu/src/copy/*`.
- Customer-facing Chinese copy, including validation messages, empty states, toasts, confirmation text, and recoverable error text, must be extracted into the corresponding copy file before completion.
- Every copy file must start with a short comment explaining which module, page, or error surface it owns, so later copy optimization and internationalization can happen in one place.
- Backend messages that may be returned to users must go into `tapu/server/copy/*`; route handlers and services should not invent one-off user-facing error strings.
- Reuse existing style variables and shared patterns before adding new visual primitives.
- Similar styles appearing in multiple places should be extracted into shared styles or shared tokens.
- New customer-facing pages should default to `wm-page` + `wm-shell`, and style differences should be expressed through semantic design tokens before page-local CSS.
- Buttons, chips, panels, modals, empty states, and loading states should reuse `tapu/src/styles/design-system.css` `.wm-*` base classes unless the page has a clear product reason to diverge.
- Customer-facing buttons, loading indicators, empty/error states, and OS playback controls should prefer `tapu/src/components/common/WmButton.vue`, `WmLoading.vue`, and `WmState.vue` over raw `<button>` plus local CSS.
- If a new interaction needs a visual variant such as danger, inverse, glass, loading, or block button, extend the shared component/token layer first; do not define one-off button systems in a page.
- `/play` and other NFC/tap runtime surfaces are customer-facing OS surfaces; their error prompts, loading animation, replay/unmute controls, and entry prompts must stay aligned with the same design tokens as normal pages.
- Frontend network access must go through `tapu/src/api/*`; do not scatter raw fetch calls.
- New backend routes must follow the current `routePermissions + operation + contract` pattern.
- Do not create parallel admin shells, duplicate route trees, or one-off routing conventions.
- Customer-facing navigation and copy must respect user state: unknown / unowned users see world and invitation paths first; owned users see Mint Space first.
- Avoid task, level, gacha, warehouse, shelf, and hard-advertising language unless the user explicitly asks for that direction.
- Avoid preset IP relationship, CP, friendship matrix, and Space notes as product defaults unless the user explicitly reopens that direction.

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
