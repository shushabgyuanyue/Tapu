# WhatMint 业务流程与接手说明

更新时间：2026-07-13

## 1. 当前产品定位

WhatMint 不是单纯的 NFC 产品，而是帮助用户邀请有灵的存在进入生活，并逐渐打造属于自己的 **Mint Space** 的情感世界平台。当前实现优先服务 **情绪 IP 类**，典型实体是纸巾小狗这类情绪摆件。

核心链路：

```text
发现世界 -> 邀请存在 -> 官方录入订单并生成 token -> token/NFC 链接写入物件 -> 创作中心按内容定义创建内容实例 -> 内容绑定到物件实例 -> 触碰物件打开对应体验 -> 接入 Mint Space
```

## 2. 完整业务流程

1. 用户在外部渠道购买实体 IP，获得订单号。
2. 官方在 `/official/orders` 录入外部订单，选择 IP，可手填订单号/token，也可自动生成。
3. 系统创建 `orders` 与 `ip_instances`，生成 128-bit 随机 token，并记录 `nfc_written_at`、`token_delivered_at`。
4. 官方将 `/play?key=<token>` 写入 NFC 芯片，并将 token 或 NFC 实体发放给购买用户。
5. 用户进入内容详情 `/content/:id`，可以直接输入 token，把当前内容写入未绑定实体。
6. 用户也可以进入 `/assets` 对客呈现的 Mint Space，登录后绑定 token；若 URL 带 `defaultContentId`，绑定成功后会自动尝试写入默认内容。
7. 用户通过物件 NFC 进入对应轻应用，系统按物件默认内容、官方默认内容、内容定义规则组织体验。
8. token 未绑定账号前，可凭 token 反复修改公开默认内容。
9. token 绑定账号后，只能登录对应账号修改默认内容、创建私有内容、转赠或解绑。
10. 转赠推荐使用账号一键转赠，token 不变，`ip_instances.owner_user_id` 变更并写入事件。
11. 若运输中 token 泄露被抢绑，一个月内可用订单号提交申诉，官方审核后解绑。

## 3. 权限规则

| 操作 | 是否登录 | 权限规则 |
|------|----------|----------|
| NFC 播放公开内容 | 否 | 只需要 token |
| 查看私有内容 | 是 | 必须是实体持有账号或 admin |
| 未绑定 token 设置默认内容 | 否 | 凭 token，只允许公开 ready 内容 |
| 已绑定实体设置默认内容 | 是 | 必须是实体持有账号或 admin |
| 创建普通内容 | 是 | 通过创作中心和内容定义创建 |
| 创建并绑定物件内容 | 是 | 未绑定物件需提供 token；已绑定物件需持有账号或 admin |
| 创建私有内容 | 是 | 必须归属账号或物件实例 |
| 账号绑定 token | 是 | token 未绑定或已绑定当前账号 |
| 转赠实体 | 是 | 当前实体持有人 |
| 申诉解绑 | 否/是 | 订单号必填，token 可选，官方人工审核 |
| 官方订单/IP/系列/应用管理 | 是 | admin only |

## 4. 关键数据库关系

### `users`

账号与资产持有人。用户拥有 `ip_instances`，也可以创建和管理自己的 `content_instances`。

### `ip_definitions`

IP 定义，例如纸巾小狗、耳机小姐。包含实体信息、商品信息、创作者信息和官方设定。

### `application_definitions`

应用定义。用于声明体验流、内容模板、事件订阅和 Skill 能力。

关系：`ip_definitions *-* application_definitions`，当前业务上通常一对一。

### `content_definitions`

内容创作能力定义，例如耳机小姐的“插画 + 音频故事序列”。创作中心按它生成引导。

关系：`application_definitions *-* content_definitions`。

### `ip_instances`

一个具体物件资产，对应一个 token：

- `token` / `entity_key`：当前新逻辑使用同一个 128-bit 随机值。
- `owner_user_id`：持有账号，未绑定时为空。
- `external_order_no`：外部订单号。
- `bound_at` / `unbound_at`：绑定状态时间。

关系：`users 1-* ip_instances`，资产只能归一个用户。

### `content_instances`

真正的内容资产。官方创作和用户创作都进入这张表，再通过关系表绑定到 IP 实例。

关系：`ip_instances *-* content_instances`。

### `resources`

图片、音频、视频等文件资源本身。资源通过 `content_instance_resource_links` 被内容实例引用。

关系：`content_instances *-* resources`。

### `events`

高价值事实记录，例如绑定、解绑、转赠、内容创建、内容删除、内容默认绑定。操作日志如果存在，只用于提取事件，不作为核心业务事实。

### `orders`

外部订单录入记录。当前外部订单由 admin 录入，`buyer_user_id` 是录入人账号，不代表真实外部买家。

重要字段：

- `external_order_no`
- `entity_id`
- `entity_key`
- `order_source`
- `nfc_written_at`
- `token_delivered_at`

## 5. 关键代码入口

| 能力 | 文件 |
|------|------|
| 登录、账户、申诉 | `tapu/server/routes/auth.js` |
| Mint Space OS 入口、绑定、转赠、默认内容 | `tapu/server/routes/assets.js`、`tapu/server/services/assetSpace.js` |
| 创作中心解析和内容列表 | `tapu/server/routes/mintStudio.js` |
| 内容定义资源上传和内容实例创建 | `tapu/server/routes/authoring.js` |
| 内容详情、删除、版本草稿和发布 | `tapu/server/routes/contents.js` |
| NFC 核心内容解析 | `tapu/server/routes/contents.js` |
| 外部订单录入和搜索 | `tapu/server/routes/orders.js` |
| 持有记录查询 | `tapu/server/routes/entities.js` |
| 应用技术层 | `tapu/server/routes/applications.js` |
| 数据库 schema / migrations | `tapu/server/db/schema.sql`、`tapu/server/db/index.js` |
| API 封装 | `tapu/src/api/index.ts` |
| Mint Space 页面 | `tapu/src/views/AssetsPage.vue` |
| 内容详情直写 token | `tapu/src/views/ContentDetailPage.vue` |
| 商城展示页 | `tapu/src/views/ShopPage.vue`、`tapu/src/views/ShopIpDetailPage.vue`、`tapu/src/components/shop/ShopProductCard.vue` |
| 耳机小姐故事空间 | `tapu/src/views/EarphoneGirlPage.vue` |
| NFC 播放器 | `tapu/src/views/PlayerView.vue` |
| 官方订单页 | `tapu/src/views/official/OrderManage.vue` |
| 持有记录页 | `tapu/src/views/official/OwnershipManage.vue` |

## 6. 已完成的实际流程测试

2026-07-13 使用临时数据库、临时上传目录、独立端口真实启动后端完成 E2E 测试，测试结束后已删除临时数据和脚本。

覆盖项：

- admin 录入应用、系列、IP、外部订单。
- 非 admin 无法创建 IP。
- 创建公开内容并进入内容实例。
- 外部订单生成 128-bit token。
- 未绑定 token 可设置公开默认内容。
- NFC 未绑定状态可播放公开默认内容。
- 账号绑定 token 后，匿名修改默认内容被拒。
- 持有人可修改默认内容。
- 持有人创建私有内容并绑定 token。
- 匿名 NFC 不返回私有内容。
- 持有人登录后 NFC 可播放私有默认内容。
- 转赠后旧持有人无权修改，新持有人可修改。
- 订单号 + token 可提交申诉，admin 审核后解绑。
- 解绑后 token 可重新绑定。
- 持有记录包含订单、内容写入、绑定、转赠、申诉解绑。
- 订单记录包含 NFC 写入与 token 发放时间。

结果：`42/42 PASS`。

## 7. 已知取舍

- 私有内容必须登录对应账号才能看；匿名 NFC 不会直接播放私有内容。这是安全规则，不是 bug。
- 外部订单真实买家信息暂未建模；当前订单的 `buyer_user_id` 表示后台录入人。
- 订单状态目前只粗略表示 `pending/shipped/completed`，NFC 写入和 token 发放已用独立时间字段记录。
- 购买不在平台内完成，商城只做 IP 介绍、应用体验和外部邀请入口。
- 社区和心愿单已退出第一版主路径，不再保留前台开关和独立页面。
- `/assets` 作为 Mint Space 路径保留，提供“接入新 IP / 接入 token”能力；同一输入框会围绕实体 IP token 处理绑定。
- 商城页已收敛为 `ShopPage` + `ShopProductCard` + `ShopIpDetailPage`，后续扩展 IP 介绍、应用体验和邀请入口时优先扩展组件，不要恢复社区、心愿单或站内交易分支。
- 耳机小姐故事空间按实例级故事队列推进，联动副轨不覆盖主故事队列。
- 登录头像菜单中的 `/assets` 入口对客显示为 Mint Space；实体管理能力下沉到伙伴详情。
- Mint Space 与 IP 详情页已收敛大图、阴影和 hero 高度，让 `/assets` 从展柜转向可进入体验、创作和管理的生态入口。

## 8. 后续只有高收益才建议做

- 给外部订单增加真实买家引用字段，例如 `external_buyer_ref`、`external_platform`。
- 给私有内容 NFC 匿名播放增加更明确的前端提示，避免用户误解“实体坏了”。
- Mint Space 已拆为页面编排、资产服务 composable、展示组件和独立样式；后续扩展优先复用 `components/assets/*`，不要把流程重新写回页面。
- 后续耳机小姐管理能力优先走核心对象、创作中心和官方内容绑定，不再恢复旧贴纸后台。
- 增加可重复运行的 E2E 测试脚本，但需要先决定是否引入测试框架和测试数据策略。
## 2026-07-14 流程复测与口径更新

### 情绪 IP 主流程复测

- 使用临时 DB、临时上传目录和真实 HTTP 服务完成复测，测试结束后已删除临时数据和脚本。
- 覆盖链路：用户外部购买获得订单号；官方录入订单并生成 128-bit token；订单记录包含 `nfc_written_at` 与 `token_delivered_at`；token 可搜索；未绑定 token 可设置公开默认内容；用户登录后绑定 token；其他账号无法抢绑；持有人可创建私有内容并设为默认；转赠后旧持有人不可修改，新持有人可修改。
- 本轮修复：持有人通过 `/api/assets/instances/:entityId/default-content` 修改默认内容时，事件会携带 token/order 信息，便于后续物件持有传承审计；资产交易不再挂在 `/api/auth` 下，账号域只保留登录、账户资料、申诉等职责。

### 耳机小姐流程口径

- 耳机小姐不再沿用旧贴纸应用的日历式故事模型；首版按核心对象、官方内容实例和实例级故事队列组织体验。
- 官方内容通过创作中心创建，再由官方权限手动选择默认或联动内容，避免形成第二套官方内容运营后台。

### 核心内容与 NFC 播放口径

- `/play?key=<token>` 先通过 `/api/contents/resolve-by-token` 解析 IP 实例，再打开该实例的 `owner_default` 内容；若未设置，则回落到该 IP 的官方默认内容。
- token 只授权当前物件的默认内容播放，不提供任意私有内容检索能力；内容详情和内容管理仍按登录用户、owner/admin 权限判断。
- 播放器是 OS 内容渲染入口，具体视频、音频、AR 或网页体验由内容定义里的 renderer/template 决定。
- NFC 线下冷启动用户应先看到实体数字体验，再被克制引导绑定到 Mint Space 或了解 WhatMint；绑定后基本不再展示广告式引导。

### 前端维护建议

- `AssetsPage.vue` 已拆为 Mint Space 编排层；后续继续开发资产域时复用 `components/assets/*` 和 `useAssetSpace`。
- `ShopIpDetailPage.vue` 是新的核心商城详情页；后续扩展优先拆 hero、故事档案、规格、内容预览组件，不恢复旧社区详情。
