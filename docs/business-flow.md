# WhatMint 业务流程与接手说明

更新时间：2026-07-13

## 1. 当前产品定位

WhatMint 不是单纯的 NFC 产品，而是给实体安装“情绪应用”的内容系统。当前实现优先服务 **情绪 IP 类**，典型实体是纸巾小狗这类情绪摆件。

核心链路：

```text
外部购买 -> 官方录入订单并生成 token -> token/NFC 链接写入实体 -> 用户上传或选择内容 -> 内容绑定到实体 -> 碰一下 NFC 播放
```

## 2. 完整业务流程

1. 用户在外部渠道购买实体 IP，获得订单号。
2. 官方在 `/official/orders` 录入外部订单，选择 IP，可手填订单号/token，也可自动生成。
3. 系统创建 `orders` 与 `entities`，生成 128-bit 随机 token，并记录 `nfc_written_at`、`token_delivered_at`。
4. 官方将 `/play?key=<token>` 写入 NFC 芯片，并将 token 或 NFC 实体发放给购买用户。
5. 用户进入内容详情 `/content/:id`，可以直接输入 token，把当前内容写入未绑定实体。
6. 用户也可以去 `/assets` 登录后绑定 token；若 URL 带 `defaultVideoId`，绑定成功后会自动尝试写入默认内容。
7. 用户通过实体 NFC 进入 `/play?key=<token>`，系统按实体默认内容、官方默认内容、最新公开内容顺序播放。
8. token 未绑定账号前，可凭 token 反复修改公开默认内容。
9. token 绑定账号后，只能登录对应账号修改默认内容、上传私有内容、转赠或解绑。
10. 转赠推荐使用账号一键转赠，token 不变，`entities.user_id` 变更并写入持有记录。
11. 若运输中 token 泄露被抢绑，一个月内可用订单号提交申诉，官方审核后解绑。

## 3. 权限规则

| 操作 | 是否登录 | 权限规则 |
|------|----------|----------|
| NFC 播放公开内容 | 否 | 只需要 token |
| 查看私有内容 | 是 | 必须是实体持有账号或 admin |
| 未绑定 token 设置默认内容 | 否 | 凭 token，只允许公开 ready 内容 |
| 已绑定实体设置默认内容 | 是 | 必须是实体持有账号或 admin |
| 上传普通内容 | 是 | 登录用户可上传 |
| 上传并绑定实体内容 | 是 | 未绑定实体需提供 token；已绑定实体需持有账号或 admin |
| 上传私有内容 | 是 | 必须绑定到实体 |
| 账号绑定 token | 是 | token 未绑定或已绑定当前账号 |
| 转赠实体 | 是 | 当前实体持有人 |
| 申诉解绑 | 否/是 | 订单号必填，token 可选，官方人工审核 |
| 官方订单/IP/系列/应用管理 | 是 | admin only |

## 4. 关键数据库关系

### `applications`

技术层应用定义。用户侧不可见，用于抽象后续应用类型，例如情绪 IP、日常贴纸、传信、收藏手作。

关系：`applications -> series -> groups(IP) -> entities(token)`

### `series`

系列，用户侧可见。可关联一个 `application_id`。

### `groups`

IP 或业务场景，例如纸巾小狗。包含官方默认内容、价格、库存、众筹字段。

### `entities`

一个实体对应一个 token：

- `token` / `entity_key`：当前新逻辑使用同一个 128-bit 随机值。
- `user_id`：持有账号，未绑定时为空。
- `external_order_no`：外部订单号。
- `bound_at` / `unbound_at`：绑定状态时间。

### `orders`

外部订单录入记录。当前外部订单由 admin 录入，`buyer_user_id` 是录入人账号，不代表真实外部买家。

重要字段：

- `external_order_no`
- `entity_id`
- `entity_key`
- `order_source`
- `nfc_written_at`
- `token_delivered_at`

### `videos`

内容资源：

- `group_id`：所属 IP。
- `entity_id`：绑定到某个实体时填写。
- `owner_user_id`：上传者。
- `is_private`：私有内容必须绑定实体，且仅持有人/admin 可查看。

### `user_defaults`

实体默认播放内容。NFC 解析时优先读取该表。

### `entity_ownership_events`

token 持有历史，为实体传承做数据基础。当前事件包括：

- `official_order_created`
- `token_issued`
- `content_default_set`
- `bind`
- `unbind`
- `transfer`
- `appeal_unbind`

## 5. 关键代码入口

| 能力 | 文件 |
|------|------|
| 登录、绑定、转赠、默认内容、申诉 | `tapu/server/routes/auth.js` |
| NFC 解析、上传、私有内容权限 | `tapu/server/routes/videos.js` |
| 外部订单录入和搜索 | `tapu/server/routes/orders.js` |
| 持有记录查询 | `tapu/server/routes/entities.js` |
| 应用技术层 | `tapu/server/routes/applications.js` |
| 数据库 schema / migrations | `tapu/server/db/schema.sql`、`tapu/server/db/index.js` |
| API 封装 | `tapu/src/api/index.ts` |
| 资产页 | `tapu/src/views/AssetsPage.vue` |
| 内容详情直写 token | `tapu/src/views/ContentDetailPage.vue` |
| 商城展示页 | `tapu/src/views/ShopPage.vue`、`tapu/src/components/shop/ShopFilterBar.vue`、`tapu/src/components/shop/ShopProductCard.vue` |
| NFC 播放器 | `tapu/src/views/PlayerView.vue` |
| 官方订单页 | `tapu/src/views/official/OrderManage.vue` |
| 持有记录页 | `tapu/src/views/official/OwnershipManage.vue` |

## 6. 已完成的实际流程测试

2026-07-13 使用临时数据库、临时上传目录、独立端口真实启动后端完成 E2E 测试，测试结束后已删除临时数据和脚本。

覆盖项：

- admin 录入应用、系列、IP、外部订单。
- 非 admin 无法创建 IP。
- 上传公开内容并转码 ready。
- 外部订单生成 128-bit token。
- 未绑定 token 可设置公开默认内容。
- NFC 未绑定状态可播放公开默认内容。
- 账号绑定 token 后，匿名修改默认内容被拒。
- 持有人可修改默认内容。
- 持有人上传私有内容并绑定 token。
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
- 购买不在平台内完成，商城和心愿单只做展示与用户教育。
- 社区和心愿单默认关闭，由官方管理开关控制。
- `/assets` 顶部和空展馆态都有“绑定新资产 / 去绑定 token”入口；同一输入框会智能尝试实体 IP 与日常贴纸 token，仍保留单独绑定按钮。
- 商城页已拆出 `ShopFilterBar` 与 `ShopProductCard`，页面本体保留数据编排和业务动作；后续扩展商品信息时优先扩展组件，不要把卡片逻辑写回页面。

## 8. 后续只有高收益才建议做

- 给外部订单增加真实买家引用字段，例如 `external_buyer_ref`、`external_platform`。
- 给私有内容 NFC 匿名播放增加更明确的前端提示，避免用户误解“实体坏了”。
- 将资产页继续拆为 `BindTokenCard`、`AssetCard`、`StickerAssetCard`、`TransferPanel`、`DefaultContentPicker`，降低维护成本；当前资产页仍超过 500 行，是下一轮前端重构优先级最高的页面之一。
- 将官方日常贴纸管理继续拆为故事预览、内容编辑、Token/NFC、发布设置四个子组件；当前文件较长但业务边界清晰。
- 增加可重复运行的 E2E 测试脚本，但需要先决定是否引入测试框架和测试数据策略。
