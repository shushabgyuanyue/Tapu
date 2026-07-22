# WhatMint OS / App Boundary

This document defines how WhatMint separates OS capabilities from self-operated light-app expression. Every new app should answer this boundary before implementation.

## Core Principle

```text
OS provides stable meaning infrastructure.
Apps provide situated life experiences.
```

WhatMint OS should not define the magic moment itself. It should let object identity, scene context, content, account permission, events, states, and rendering protocols move safely through the system.

Current product default:

- One IP maps to one application, one entity entrance, and one specific life scene.
- The technical model may keep many-to-many relation tables for future extension, but product design should not create large all-purpose IPs.
- WhatMint is currently a closed, self-operated app. Co-branding enters as scene-specific expression, skin, copy, and resources after the OS pattern is stable.

## New App Intake Questions

Before building a new app, write one short answer for each question:

- Object: what physical object must this experience belong to?
- Behavior: why would a person touch or open this object?
- Meaning: what one life question, object expression, or real-world action does this app answer?
- OS reuse: which existing OS capabilities will it use?
- App-owned expression: which parts must stay unique to this app?
- Runtime context: which `states`, `unlockedSkills`, `ownedMintHints`, or `contentModifiers` can change the experience?
- Studio flow: what does a creator need to customize, upload, or confirm?
- Admin flow: what official content or domain data does the team need to manage?

If the app cannot be described as `object x behavior x meaning`, pause before development.

## OS Owns

- Object Identity: token, object id, asset ownership, object registry, token resolving.
- Permission: route permission type, operation policy, call-before-handler validation.
- Tap Runtime: stable tap response protocol, object/app/content/actions/permissions shell.
- Content Container: portable content block protocol and browser-compatible rendering surface.
- Event Ledger: high-value object events such as tap, content view, media play, bind, and action.
- Meaningful State: product-level states derived from events, such as `comfort.action_active`.
- Skill Matching: manifest skills, trigger evaluation, and unlocked skill output.
- Runtime Context: the standard context passed into every light app.
- Mint Studio Shell: token recognition, recipe selection, upload surface, content asset inspection.
- App Manifest and Adapter Registry: app type, object principle, routes, Studio profile, permissions, content capabilities, states, skills, and adapter entrypoints.
- Object Resolver Registry: app token lookup should be registered as resolver entries instead of growing a central `if/else` chain.
- Mint Studio Recipe Catalog: Studio open routes, UI profiles, and creator-entry diagnostics should be read from one catalog tied to app adapters and manifests.
- OS Capability Matrix: every app must pass a cross-module contract check covering manifest, adapter, Studio profile, open API, runtime context, and permission operations.

## Apps Own

- The life question or behavior the app answers.
- Why the experience belongs to this physical object.
- App-specific data tables and domain logic.
- Ritual, rhythm, visual language, and interaction sequence.
- Domain content assembly, such as a comfort scene, AR scene, or future app-specific content block.
- How `runtimeContext` becomes visible as user experience.
- App-specific Studio recipe details and admin content forms.

## App Adapter Contract

Each light app should register an adapter with this shape:

```js
{
  manifest,
  resolveObject({ db, key }),
  recordEvents({ db, event }),
  deriveAppStates({ db, event }),
  buildRuntimeContext({ db, resolvedObject, options }),
  assembleExperience({ content, blocks, runtimeContext }),
  studioRecipe,
  adminConfig
}
```

## Application Lifecycle

应用生命周期是 OS 能力，不由单个应用自己解释。

标准状态：

- `active`：正常对客服务；商城发现、NFC 触碰、Studio 和官方后台都可用。
- `hidden`：不进入商城发现，但既有 token / Studio / 后台仍可继续服务，适合灰度、内测或不再主动推广的应用。
- `suspended`：暂停对客服务；商城、NFC 和 Studio 都关闭，只保留后台诊断与数据。只适用于仍有必要保留代码诊断的应用。
- `retired`：产品和代码都已下线；启动时不再 seed 内容定义，数据清理通过 retired registry 执行。

每个 manifest 必须能被归一化为：

```js
{
  status: 'active',
  activeVersion: '1.0.0',
  rollout: 'stable',
  surfaces: {
    shop: true,
    nfc: true,
    studio: true,
    admin: true
  }
}
```

OS 负责让生命周期在这些入口统一生效：

- 商城只展示 `shop` 开启的应用。
- `/play` 只服务 `nfc` 开启的应用。
- Mint Studio 只允许 `studio` 开启的应用进入创建、修改和内容库。
- 官方后台可以保留 `admin` 入口，用于诊断、恢复或退休清理。

已明确退休的旧轻应用不保留 manifest、路由、Studio profile 或官方卡片；后续恢复时按新核心范式重新实现。

## Function Responsibilities

- `resolveObject`: OS object lookup. Default should use the object registry unless the app has a strong reason not to.
- `recordEvents`: write significant app actions to the OS event ledger.
- `deriveAppStates`: convert events into meaningful OS states when those states can change later experiences.
- `buildRuntimeContext`: return the standard runtime context for this object and account.
- `assembleExperience`: app-owned final expression. It may insert story blocks, choose variants, or apply content modifiers.
- `studioRecipe`: creator-facing flow configuration for Mint Studio.
- `adminConfig`: official management entry and domain config.

## Standard Runtime Context

Every light app should receive and may return:

```js
{
  states: [],
  unlockedSkills: [],
  ownedMintHints: [],
  contentModifiers: []
}
```

- `states`: meaningful OS states available to this account, object, or token.
- `unlockedSkills`: manifest skills unlocked by the current states.
- `ownedMintHints`: lightweight hints about the user's owned Mints, used for scene-aware experiences without direct table coupling.
- `contentModifiers`: normalized effects derived from unlocked skills, used by apps to alter content without knowing the whole OS matching process.

## Boundary Examples

- OS stores `comfort.action_active`. Tissue Puppy decides how that becomes a restrained comfort expression.
- OS renders `ContentBlock`. A future app decides what its own restrained expression sounds like.
- OS validates `asset:claim`. Tissue Puppy and Desktop Secret decide what claiming their physical entry means in that specific scene.
- OS exposes `ownedMintHints`. A future app decides whether another owned entity should quietly enrich the current scene.
- OS resolves app tokens through registered object resolvers. A new app should add one resolver entry instead of editing unrelated app lookup branches.
- OS resolves Studio app labels and open routes through the Mint Studio recipe catalog. A new app should not add another local route map inside a page or route handler.
- OS capability checks are quality gates, not documentation only. If a new app misses an adapter, Studio profile, open endpoint, or `runtime_context`, `check:os` should fail.

## Review Checklist

- If code touches routing, token identity, permissions, content blocks, events, meaningful states, skill matching, or runtime context, ask whether it belongs in OS.
- If code contains character voice, story wording, visual rhythm, app-specific fields, or domain-specific actions, keep it in the app layer.
- If a service imports one app's tables and another app's tables, pause and introduce an OS state, runtime hint, or adapter boundary.
- If adding a new light app requires editing multiple unrelated resolver branches, move that lookup into an object resolver entry.
- If adding a new light app requires editing Mint Studio route maps in more than one place, move that data into the recipe catalog or manifest.
- If an app works manually but fails the OS capability matrix, treat it as not fully integrated yet.
- If a manifest declares a skill, the app should have a visible way to express that skill.
- If a state is only useful for analytics and never changes an experience, do not add it yet.
