# WhatMint Content Operation

Content Operation is not a traditional CMS. It is the OS layer that lets official content, object events, meaningful states, Mint relationships, and app skills assemble into new experiences.

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
- Skill and Relationship: app manifests declare what an app can produce and what states it can respond to.
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
- Earphone Girl uses its adapter to turn `guest_character_story` into a visible crossover block.
- Emotion IP, Answer Book, Moment, Travel Trail, and Check now return the same `runtime_context` shape.

## Demo Sample

The built-in earphones story token has a seeded `comfort.action_active` state from `emotion-ip / 纸巾小狗`.

When the Earphone Girl app resolves that token, it unlocks:

```text
guest_character_story
```

The returned content includes a crossover block:

```text
纸巾小狗来过

今天遇到了纸巾小狗。
它说，最近好像有人需要一点安慰，所以带来了一张特别的纸巾。
```

This proves the first Content Operation loop:

```text
Mint app produces meaningful state
-> WhatMint OS stores and matches it
-> another Mint changes its content experience
```

## Design Guardrails

- Apps should not read each other's private tables directly.
- Apps read OS-level states, unlocked skills, owned Mint hints, and content modifiers.
- State names should describe meaning, not cold user segmentation.
- Experience assembly should stay restrained and visible to users as story, not as system mechanics.
- OS should match states and skills; apps should decide how an unlocked skill becomes visible.
- New app integrations should start from the adapter shape in `docs/os-app-boundary.md` before adding app-specific routes or services.
