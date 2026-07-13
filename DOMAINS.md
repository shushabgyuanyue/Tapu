# WhatMint / tapU · 模块与分工

## 整体进度快照

| 一级域 | 估计完成度 | 状态 | 备注 |
|--------|------------|------|------|
| product-flow | 90% | 已联调 | 外部订单 -> token -> 实体 -> 内容 -> NFC 播放主链路已通过 E2E |
| auth-asset | 90% | 已联调 | token 绑定、未绑定修改、绑定后账号权限、转赠、申诉解绑已实现 |
| frontend | 90% | 可继续拆分 | 首页黑紫粉风格已延展到资产/内容/商城/IP详情页，商城卡片已组件化，贴纸页支持分钟级自动刷新 |
| backend | 90% | 已联调 | Express + SQLite + 上传转码 + 权限收紧 + 持有记录 |
| storage | 40% | 待对接 | R2 代码已存在，需配置环境变量并做真实 CDN 验证 |
| operations | 70% | 可用 | 官方订单、应用、持有记录、申诉、开关配置已可用 |

## 域分工

### product-flow

职责：

- 维护 WhatMint 当前情绪 IP 业务闭环。
- 定义外部购买、官方录入、token 发放、NFC 写入、用户绑定、内容写入、播放体验。
- 避免把购买、社区、应用技术层过早混进用户主流程。

关键文档：[docs/business-flow.md](docs/business-flow.md)

### auth-asset

职责：

- token 为 128-bit 随机唯一值，一个 token 对应一个实体。
- `entities.user_id` 表示当前持有账号，未绑定时为空。
- 未绑定 token 可凭 token 修改公开默认内容。
- 绑定后必须登录持有账号修改内容、转赠或解绑。
- 持有变化写入 `entity_ownership_events`。

关键代码：

- `tapu/server/routes/auth.js`
- `tapu/server/routes/entities.js`
- `tapu/src/views/AssetsPage.vue`

### frontend

职责：

- 首页与用户主路径保持黑/紫/粉情绪 IP 风格。
- 商城、社区、心愿单拆成独立顶部导航；社区和心愿单默认关闭。
- 商城商品卡与筛选条已拆为组件，页面本体只负责数据编排和动作分发。
- 内容详情支持预览、跳转资产绑定、直接输入 token 写入实体。
- 资产页顶部和空展馆态提供 token 绑定入口，支持实体 IP 与日常贴纸智能绑定。
- 日常贴纸触碰页支持分钟级 cron 自动静默刷新，刷新后重新触发内容卡动画。
- 账户下拉菜单顺序固定为“我的资产 -> 解绑申诉 -> 账户设置”。
- `/play?key=...` 是 NFC 播放入口。

关键代码：

- `tapu/src/views/LandingPage.vue`
- `tapu/src/views/ShopPage.vue`
- `tapu/src/components/shop/ShopFilterBar.vue`
- `tapu/src/components/shop/ShopProductCard.vue`
- `tapu/src/views/AssetsPage.vue`
- `tapu/src/views/DailyStickerPage.vue`
- `tapu/src/views/IPDetailPage.vue`
- `tapu/src/views/ContentDetailPage.vue`
- `tapu/src/views/PlayerView.vue`

### backend

职责：

- Express API、SQLite、视频上传与 FFmpeg 转码。
- 外部订单录入、token 生成、实体资产关系、应用技术层。
- 私有内容权限和 admin-only 官方管理边界。

关键代码：

- `tapu/server/db/index.js`
- `tapu/server/db/schema.sql`
- `tapu/server/routes/orders.js`
- `tapu/server/routes/videos.js`
- `tapu/server/routes/applications.js`

### storage

职责：

- 本地上传目录与 Cloudflare R2 兼容存储。
- 当前本地可用，R2 需要环境变量配置后做线上验证。

关键代码：

- `tapu/server/services/storage.js`
- `tapu/server/services/r2.js`

### operations

职责：

- 官方管理后台：应用、IP、订单、申诉、持有记录、站点开关。
- 订单录入后视为 token 已发放、NFC 链接已写入，并记录时间。

关键代码：

- `tapu/src/views/official/OrderManage.vue`
- `tapu/src/views/official/ApplicationManage.vue`
- `tapu/src/views/official/AppealManage.vue`
- `tapu/src/views/official/OwnershipManage.vue`
- `tapu/src/views/official/SiteSettings.vue`
## 2026-07-14 Codex Domain Update

### product-flow

- 已用临时 DB + 临时上传目录 + 真实 HTTP 服务复测情绪 IP 主链路：外部订单录入生成 128-bit token，订单可按订单号/token 搜索，NFC 写入与 token 发放时间戳存在，未绑定 token 可设置公开默认内容，绑定后防抢绑，持有人可上传私有内容并设默认，转赠后旧持有人失权、新持有人可修改。
- 产品口径明确：`/play?key=<token>` 可匿名播放公开内容；私有内容不会因持有 token 而匿名泄露，必须登录实体持有人账号或 admin 后才可查看。

### auth-asset

- `entity_ownership_events` 是实体传承审计链的核心记录；`content_default_set` 事件必须尽量带上 `token` 与 `order_id`，便于从订单、token、内容变更三个维度追踪。
- 本轮修复了持有人通过 `/auth/entity-default/:entityId` 修改默认内容时事件缺 token/order 的问题。

### daily-sticker

- 已用临时 DB 复测日常贴纸应用链路：官方创建人格、世界、故事、每日条目和 token；公开 resolve 可按 `day` 预览；token 绑定后进入用户资产；已绑定 token 防止其他账号抢绑。
- 默认分钟级 cron `*/1 * * * *` 可用于测试，正式内容仍建议按故事节奏设置。

### frontend

- 商城、资产展馆、IP 详情页已继续靠近“高端商城 + 社交收藏展馆”的视觉方向，并保持首页黑/紫/粉品牌氛围。
- 仍需关注体量：`AssetsPage.vue`、`DailyStickerManage.vue`、`IPDetailPage.vue` 已超过 500 行。下一轮若继续开发同域，优先拆为业务组件，避免样式和流程逻辑继续堆在页面文件。
