# WhatMint OS / App Boundary

This document defines the boundary between WhatMint OS capabilities and light-app capabilities. The goal is to keep new apps fast to build without turning the OS into a vague place where app-specific expression disappears.

## Principle

OS provides stable infrastructure. Apps provide situated experience.

```text
OS does not define emotion.
OS lets emotion move safely between objects, content, accounts, and apps.
```

## OS Owns

- Object Identity: token, object id, asset ownership, object registry.
- Permission: route permission type, operation policy, call-before-handler validation.
- Tap Runtime: stable tap response protocol, object/app/content/actions/permissions shell.
- Content Container: portable content block protocol and browser-compatible rendering surface.
- Event Ledger: cross-app object events such as tap, content view, media play, bind, and action.
- Meaningful State: product-level states derived from events, such as `comfort.action_active`.
- Content Operation Context: state lookup, skill matching, and runtime context.
- Mint Studio Shell: token recognition, recipe selection, asset upload, content asset inspection.
- App Manifest Contract: app type, object principle, routes, Studio profile, permissions, content capabilities, states, and skills.

## Apps Own

- The life question or behavior the app answers.
- Why the experience belongs to this physical object.
- App-specific data tables and domain logic.
- Ritual, rhythm, visual language, and interaction sequence.
- How `runtimeContext.states` and `runtimeContext.unlockedSkills` become visible experience.
- App-specific content assembly, such as a Daily Sticker guest-character story block.
- Admin surfaces that create or edit domain-specific data.

## Adapter Shape

Each mature light app should gradually converge toward this adapter shape:

```js
{
  manifest,
  resolveObject,
  recordEvents,
  deriveAppStates,
  assembleExperience,
  studioRecipe,
  adminConfig
}
```

This does not require a big plugin system yet. It is a governance shape: new app work should make it obvious which parts are OS reuse and which parts are app expression.

## Boundary Examples

- OS decides `guest_character_story` is unlocked. Daily Sticker decides how that appears in a hand-account story.
- OS stores `comfort.action_active`. Emotion IP decides which touches count as comfort.
- OS renders `ContentBlock`. Answer Book decides what a restrained answer sounds like.
- OS validates `asset:claim`. A travel app decides what claiming a luggage sticker means in the journey flow.

## Review Checklist

- If code touches routing, token identity, permissions, content blocks, events, meaningful states, or runtime context, ask whether it belongs in OS.
- If code contains character voice, story wording, visual rhythm, app-specific fields, or domain-specific actions, keep it in the app layer.
- If a service imports one app's tables and another app's tables, pause and introduce an OS state or adapter boundary.
- If a manifest declares a skill, the app should have a visible way to express that skill.
- If a state is only useful for analytics and never changes an experience, do not add it yet.
