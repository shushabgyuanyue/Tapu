# WhatMint Content Operation

Content Operation is not a traditional CMS. It is the OS layer that lets official content, object events, meaningful states, Mint relationships, and app skills assemble into new experiences.

## Core Flow

```text
Object Event
-> Meaningful State
-> App Skill Match
-> Experience Assembly
-> Tap Response
```

## Layers

- Content Asset: official videos, story entries, audio, images, and mixed content blocks.
- Meaningful State: product-level state derived from object use, such as `comfort.action_active`.
- Skill & Relationship: app manifests declare what an app can produce and what states it can respond to.
- Experience Assembly: the runtime inserts or selects content variants when a skill is unlocked.

## Current MVP

The current implementation keeps the layer intentionally thin:

- `meaningful_states` stores OS-level states.
- `object_events` can derive states after a tap event is recorded.
- `appManifests.js` declares `producesStates` and `skills`.
- Daily Sticker resolve reads the runtime context and delegates visible crossover expression to its app adapter.

## Demo Sample

The built-in earphones story token has a seeded `comfort.action_active` state from `emotion-ip / 纸巾小狗`.

When the Daily Sticker app resolves that token, it unlocks:

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
- Apps read OS-level states and unlocked skills only.
- State names should describe meaning, not cold user segmentation.
- Experience assembly should stay restrained and visible to users as story, not as system mechanics.
- OS should match states and skills; apps should decide how an unlocked skill becomes visible.
