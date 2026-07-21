# Interface Contracts

This document defines the incremental contract discipline for WhatMint backend APIs.

## Core Model

Keep permission simple:

```text
interface -> permission type -> checker function -> handler
```

`permission` answers: who may start this transaction before business logic runs?

`operation` answers: what product action does this interface represent?

Operation must not replace permission. It is semantic metadata for documentation, audit, Mint Studio guidance, frontend API naming, and critical-flow tests.

## Route Contract Fields

When a route is touched or added, prefer registering it with:

- `method`: HTTP method.
- `path`: route path inside the router.
- `permission`: permission type or permission config.
- `operation`: semantic operation such as `content:token_update`.
- `query`: expected query shape.
- `body`: expected body shape.
- `response`: success response shape.
- `errors`: stable error codes the frontend can react to.
- `tags`: product or platform area labels.

Example:

```js
{
  method: 'put',
  path: '/content-default-by-token',
  permission: 'token_unbound_or_owner',
  operation: 'content:token_update',
  body: { key: 'string', content_id: 'string' },
  response: { success: 'boolean' },
  errors: ['TOKEN_REQUIRED', 'ENTITY_NOT_FOUND', 'LOGIN_REQUIRED'],
  handler: setContentDefaultByTokenHandler,
}
```

## Operation Catalog

The operation catalog starts in `tapu/server/contracts/operations.js`.

Use it as a shared vocabulary, not as an access-control shortcut:

- `view:open`: open public or token-addressed content.
- `content:account_create`: create account-owned content.
- `content:token_update`: update content through an editable object token.
- `content:owner_manage`: manage owned content.
- `asset:claim`: claim an object or account asset.
- `asset:owner_manage`: manage an owned object asset.
- `shop:discover`: discover public IP definitions, applications, and official experiences.
- `app:token_operate`: mutate a light app through an active app token.
- `admin:manage`: official management operation.

## App Manifest Discipline

Application manifests live in `tapu/server/contracts/appManifests.js`.

Each manifest should declare:

- `code` and `type`: one of `meaning`, `behavior`, or `state`.
- `objectPrinciple`: why this experience belongs on a physical object.
- `behavior`: why the user touches or uses that object.
- `meaningQuestion`: the one question this app answers.
- `defaultRoutes`: open, studio, and admin entry points.
- `mintStudio`: profile and primary actions.
- `permissionOperations`: operations the app relies on.
- `contentContainer`: supported media/interaction capabilities.

This lets future apps feel like registration, not scattered edits.

## Database Governance

Schema changes belong in `tapu/server/db/migrations`.

Default data and fixtures belong in `tapu/server/db/seeds`.

Both directories use stable default exports so future changes can be reviewed, tested, and eventually executed by a migration runner.

## Checks

Run from `tapu/`:

```bash
npm run check:permissions
npm run check:db
npm run check:manifests
npm run test:contracts
```
