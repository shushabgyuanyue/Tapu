# WhatMint Content Operation

Content Operation is not a traditional CMS. It is the OS layer that lets official content, object operations, meaningful states, runtime context, and app skills assemble into new experiences.

## Core Flow

```text
Object Event
-> Meaningful State
-> App Skill Match
-> Runtime Context
-> App Adapter Assembly
-> Tap Response
```

## Layers

- Content Asset: official videos, story entries, audio, images, and mixed content blocks.
- Meaningful State: product-level state derived from object use, such as `comfort.action_active`.
- Skill and Context: app manifests declare what an app can produce and what states or scene contexts it can respond to.
- Runtime Context: OS packages states, unlocked skills, owned Mint hints, and content modifiers for apps.
- Experience Assembly: the app adapter turns runtime context into visible story, behavior, or interface changes.

## Standard Runtime Context

All light apps should receive the same shape:

```js
{
  states: [],
  unlockedSkills: [],
  ownedMintHints: [],
  contentModifiers: []
}
```

This keeps cross-app behavior from becoming direct table coupling. Apps read OS-level meaning, not each other's private schema.

## Current MVP

The current implementation keeps the layer intentionally thin:

- `meaningful_states` stores OS-level states.
- `object_events` can derive states after a tap event is recorded.
- `appManifests.js` declares `producesStates` and `skills`.
- `appAdapters.js` defines the adapter contract and registry.
- `objectRegistry.js` resolves app tokens through registered object resolver entries.
- `mintStudioRecipeCatalog.js` keeps creator-entry app routes and UI profile diagnostics aligned with app adapters.
- `osCapabilityMap.js` checks that each app is connected across manifest, adapter, Studio, open API, runtime context, and permission operations.
- Paper Puppy and Desktop Secret are the only active app samples. They use content definitions plus the OS renderer to switch between video and AR without rewriting the asset or permission flow.
- Retired light apps must not be kept as compatibility shells. If an answer, checklist, memorial, or travel direction returns later, it must reconnect through manifests, adapters, content definitions, `/play`, and Mint Studio from scratch.

## Demo Sample

Paper Puppy can use the same entity token, content instance, resource links, and `/play` entry while changing its renderer from `video.fullscreen` to `ar.camera-overlay` through `content_definitions`.

This proves the first Content Operation loop:

```text
content definition declares meaning and renderer
-> Resource Pipeline adapts uploaded media
-> /play resolves the entity default content
-> OS renderer assembles the final scene experience
```

## Design Guardrails

- Apps should not read each other's private tables directly.
- Apps read OS-level states, unlocked skills, owned Mint hints, and content modifiers.
- State names should describe meaning, not cold user segmentation.
- Experience assembly should stay restrained and visible to users as story, not as system mechanics.
- OS should match states and skills; apps should decide how an unlocked skill becomes visible.
- New app integrations should start from the adapter shape in `docs/os-app-boundary.md` before adding app-specific routes or services.
