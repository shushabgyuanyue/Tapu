# 后端接口权限分配原则

本文说明新增后端接口时如何分配权限规则。目标不是把每个 handler 写得更复杂，而是让每个交易在进入业务逻辑之前，先经过统一、可解释、可复用的 OS 权限判断。

## 核心原则

每个接口都应该先回答一句话：

> 这个交易在修改谁的什么东西，调用者凭什么可以做？

权限分配遵循以下顺序：

1. 先判断交易对象是否存在，再判断登录态，再判断归属关系。
2. 权限判断必须发生在 handler 执行业务逻辑之前。
3. handler 只处理业务有效性，不重复判断“这个人有没有资格调用”。
4. 上传、绑定、认领、设置默认内容是不同交易，不能为了方便混成一个接口。
5. 能用已有权限类型就不要新增规则；新增规则必须能被多个接口复用。
6. 错误码要服务前端引导，比如未登录应返回 `LOGIN_REQUIRED`，不要直接把用户推到无权错误。

## 权限与业务的边界

权限层负责判断调用者是否可以开始这个交易。

例如：

- 这个 token 是否存在。
- 这个物件是否已绑定账号。
- 当前用户是否是物件 owner。
- 当前用户是否是内容 owner。
- 当前用户是否是 admin。
- 当前接口是否允许匿名 token 访问。

业务层负责判断交易内容是否合法。

例如：

- 视频是否属于同一个 IP。
- 内容状态是否是 `ready` 或 `processing`。
- 标题、地点、清单项是否为空。
- 旅行轨迹是否还在可编辑时间窗口内。
- 某个应用是否允许这类动作。

如果一个判断会在多个接口反复出现，它大概率应该进入 OS 权限层；如果它只属于某个应用的内容规则，它应留在业务层。

## 当前权限类型

### `public`

任何人可以调用。

适合：

- 公开配置读取。
- 应用公开 resolve。
- 公开内容浏览。

注意：公开不等于无校验。公开接口仍应校验 token、状态、内容是否可展示。

### `login_required`

必须登录，但不要求拥有某个物件或内容。

适合：

- 查看个人资料。
- 修改密码。
- 查看自己的内容资产库。
- 上传内容资产。
- 查看自己的订单或实体列表。

### `admin_required`

必须登录且为管理员。

适合：

- 官方后台应用管理。
- IP、系列、实体、订单、内容集合管理。
- 官方模板、卡片、token 的创建和维护。

原则：后台管理类接口默认使用 `admin_required`，不要在 handler 里手写 `req.user.username === 'admin'`。

### `token_unbound_or_owner`

通过 token 修改物件内容时使用。

优先级：

1. token 不存在：返回 `ENTITY_NOT_FOUND`。
2. token 未绑定账号：允许继续。
3. token 已绑定但用户未登录：返回 `LOGIN_REQUIRED`，前端引导登录。
4. token 已绑定且当前用户是 owner/admin：允许继续。
5. token 已绑定但当前用户不是 owner：admin 以外返回 `OBJECT_BOUND_TO_OTHER_ACCOUNT`。

适合：

- `PUT /api/auth/entity-default-by-token`
- Mint Studio 中“通过物件码定制内容”的交易。
- 后续通过 token 编辑轻应用作品的接口。

### `claimable_asset`

把物件/IP 资产绑定到当前账号时使用。

优先级：

1. token 不存在：返回 `ENTITY_NOT_FOUND`。
2. 用户未登录：返回 `LOGIN_REQUIRED`，前端引导登录。
3. token 未绑定账号：允许绑定。
4. token 已绑定当前账号/admin：允许幂等返回。
5. token 已绑定其他账号：返回 `ENTITY_ALREADY_BOUND`。

适合：

- `POST /api/auth/bind-entity`
- 后续实体资产认领接口。

### `entity_owner`

必须登录，并且当前用户必须拥有该实体，admin 可操作。

适合：

- 解绑实体。
- 转赠实体。
- 读取或设置已绑定实体的默认内容。

示例：

- `POST /api/auth/unbind-entity`
- `POST /api/auth/transfer-entity`
- `GET /api/auth/entity-default/:entityId`
- `PUT /api/auth/entity-default/:entityId`

### `content_owner`

必须登录，并且当前用户必须拥有该内容资产，或拥有内容绑定的实体，admin 可操作。

适合：

- 删除视频。
- 修改用户上传的内容资产。
- 后续内容资产的重命名、归档、移动。

示例：

- `DELETE /api/videos/:id`

## 已支持的扩展权限类型

这些类型来自接口排查，用于覆盖轻应用 token、账号型对象和匿名 fingerprint 场景。新增相关接口时优先考虑这些命名，而不是继续写临时判断。

### `app_token_active`

通过轻应用 token 打开或操作应用内容。

适合：

- Check 的勾选、添加、重置。
- 旅行轨迹的添加地点、设置下一站、确认归来。
- 纪念瞬间通过 token 保存作品。

它应至少判断：

- token 存在。
- token 属于指定 app。
- token 状态为 active。
- 如果应用配置要求 owner，则继续进入 owner 判断。

### `account_object_claimable`

账号型对象认领。

适合：

- 日常贴纸 token 绑定账号。
- 后续不走 `entities` 表、但同样有 `user_id` 归属字段的资产。

### `account_object_owner`

账号型对象 owner 操作。

适合：

- 日常贴纸解绑。
- 用户已经拥有的非实体资产修改。

### `anonymous_fingerprint`

允许匿名调用，但以 fingerprint 限制用户范围。

适合：

- 游客心愿单。
- 匿名互动统计。

注意：这类接口不是资产权限，不能用于修改有 owner 的内容资产。

## 接口分配示例

### 上传视频

接口：`POST /api/videos/upload`

建议权限：`login_required`

原因：上传只创建内容资产，不负责绑定实体，也不负责设置默认内容。绑定到物件应由单独交易完成。

### 通过 token 设置默认内容

接口：`PUT /api/auth/entity-default-by-token`

权限：`token_unbound_or_owner`

原因：这个交易的主体是“物件 token 是否允许被当前调用者编辑”。视频是否属于同一 IP，是业务有效性，不属于调用权限。

### 已绑定实体设置默认内容

接口：`PUT /api/auth/entity-default/:entityId`

权限：`entity_owner`

原因：实体已经属于某个账号，必须由 owner/admin 修改。

### 后台创建卡片或模板

接口：例如 `POST /api/answer-book/cards`

建议权限：`admin_required`

原因：官方内容和配置不属于用户交易，应统一由后台权限保护。

### 轻应用 token 操作

接口：例如 `POST /api/checks/items`

建议权限：`app_token_active`

原因：用户不是因为登录账号而操作，而是因为触碰或输入了有效物件 token。是否允许匿名操作应由应用配置决定，而不是散落在 handler 内。

## 新增接口检查清单

新增任何后端接口前，先回答：

1. 这个接口是公开读取、登录账号操作、后台管理、物件 token 操作，还是内容资产操作？
2. 它修改的是账号、实体、token、内容资产、应用配置，还是匿名统计？
3. 如果 token 已绑定但用户未登录，应该引导登录，还是允许匿名继续？
4. 如果用户已登录但不是 owner，错误码应该是 owner 不匹配，而不是登录错误。
5. 这个接口是否同时做了上传、绑定、设置默认内容？如果是，应拆成多个交易。
6. handler 内是否出现了 `req.user.username === 'admin'`、`entity.user_id !== req.user.id`、`owner_user_id !== req.user.id` 这类判断？如果出现，优先考虑迁到权限层。
7. 权限规则是否能被后续接口复用？如果只能服务一个接口，先确认它是不是业务规则而不是权限规则。

## 推荐实现形态

当前权限系统只保留一个核心模型：

```text
接口 -> permission type -> checker function -> handler
```

代码入口：

- `tapu/server/services/routePermissions.js`：权限执行内核，`PERMISSION_CHECKERS` 是权限类型到校验函数的唯一表。
- `tapu/server/contracts/routePermissionMap.js`：集中查询当前接口到权限类型的映射。
- `tapu/server/contracts/criticalPermissionFlows.js`：关键链路所需接口和权限类型清单。
- `tapu/scripts/check-route-permissions.mjs`：校验接口权限映射、权限类型和关键链路是否完整。

优先使用 route contract 注册：

```js
registerRoutes(router, [
  {
    method: 'put',
    path: '/entity-default-by-token',
    permission: 'token_unbound_or_owner',
    handler: setEntityDefaultByTokenHandler,
  },
]);
```

handler 中通过 `req.permission` 读取权限层解析出的 subject：

```js
async function setEntityDefaultByTokenHandler(req, res) {
  const { db, entity } = req.permission;
  // 这里只做业务有效性和数据更新。
}
```

不要在 handler 中再次手写 owner 判断。重复判断会让系统出现两套权限语言，前端也无法稳定根据错误码做引导。

如果要查看“哪个接口使用哪种校验类型”，不要在每个 route 文件里手动搜索，直接读取 `getRoutePermissionMap()`：

```js
import { getRoutePermissionMap } from './server/contracts/routePermissionMap.js';

console.table(getRoutePermissionMap().map(route => ({
  method: route.method,
  path: route.path,
  permissionType: route.permissionType,
})));
```

新增权限类型时，必须先加入 `PERMISSION_CHECKERS`。新增关键链路时，必须补充 `criticalPermissionFlows.js`，并通过：

```bash
npm run check:permissions
```

## 当前迁移状态

已接入 route contract：

- `GET /api/auth/profile`
- `PUT /api/auth/password`
- `GET /api/auth/entities`
- `POST /api/auth/entity-key`
- `POST /api/auth/bind-entity`
- `POST /api/auth/unbind-entity`
- `PUT /api/auth/entity-default-by-token`
- `POST /api/auth/transfer-entity`
- `GET /api/auth/entity-default/:entityId`
- `PUT /api/auth/entity-default/:entityId`
- `GET /api/auth/unbind-appeals`
- `POST /api/auth/unbind-appeals/:id/resolve`
- `POST /api/videos/upload`
- `DELETE /api/videos/:id`
- `PUT /api/config/:key`
- `GET /api/purchases`
- `POST /api/purchases/by-group`
- `POST /api/daily-stickers/bind-token`
- `POST /api/daily-stickers/unbind-token`
- `POST /api/checks/items`
- `PUT /api/checks/items/:itemId`
- `POST /api/checks/reset`
- `POST /api/travel-trails/places`
- `POST /api/travel-trails/next-destination`
- `POST /api/travel-trails/return`
- `GET /api/wishlist`
- `GET /api/wishlist/:groupId/status`
- `POST /api/wishlist/:groupId`
- `DELETE /api/wishlist/:groupId`
- `PUT /api/wishlist/:groupId/default`

优先迁移下一批：

- 剩余后台管理接口：`admin_required`
- 剩余登录账号接口：`login_required`
- 纪念瞬间和 Mint Studio 的 token 写接口：`app_token_active` 或 `token_unbound_or_owner`
- 匿名互动统计：`anonymous_fingerprint` 或 `public`

## 判断标准

好的权限系统应该像门口的接待员，而不是业务代码里的路障。

它先识别来的人、手里的 token、要操作的物件，再告诉前端下一步应该是继续、登录、换账号，还是停止。用户看到的是顺畅的创作和触碰体验，复杂的归属、登录和交易边界留在 OS 层安静完成。
