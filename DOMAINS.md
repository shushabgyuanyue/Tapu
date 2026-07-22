# WhatMint / tapU · 模块与分工

## 整体进度快照

| 一级域 | 估计完成度 | 状态 | 备注 |
|--------|------------|------|------|
| product-flow | 90% | 已联调 | 外部订单 -> token -> 实体 -> 内容 -> NFC 播放主链路已通过 E2E |
| mint-space | 90% | 已联调 | Mint Space、token 绑定、未绑定修改、绑定后账号权限、转赠、申诉解绑已实现 |
| frontend | 90% | 可继续拆分 | 首页黑紫粉风格已延展到资产/内容/商城/IP详情页，商城卡片已组件化，贴纸页支持分钟级自动刷新 |
| backend | 90% | 已联调 | Express + SQLite + 上传转码 + 权限收紧 + 持有记录 |
| storage | 40% | 待对接 | R2 代码已存在，需配置环境变量并做真实 CDN 验证 |
| operations | 70% | 可用 | 官方订单、应用、持有记录、申诉、开关配置已可用 |

## 域分工

### product-flow

职责：

- 维护 WhatMint 当前现实世界 UI 业务闭环。
- 定义外部邀请、官方录入、token 发放、NFC 写入、用户绑定、内容写入、播放体验。
- 避免把站内交易、社区和应用技术层过早混进用户主流程。

关键文档：[docs/business-flow.md](docs/business-flow.md)

### mint-space

职责：

- token 为 128-bit 随机唯一值，一个 token 对应一个实体。
- `ip_instances.owner_user_id` 表示当前持有账号，未绑定时为空。
- 未绑定 token 可凭 token 修改公开默认内容。
- 绑定后必须登录持有账号修改内容、转赠或解绑。
- 持有变化写入 `entity_ownership_events`。
- `/api/assets` 是 IP 实例和资产交易的正式 OS 入口；对客页面表达为 Mint Space。
- `/api/auth` 只负责身份、账户资料和申诉；IP 实例认领、解绑、转赠、默认内容维护都必须走 `/api/assets`。

关键代码：

- `tapu/server/routes/assets.js`
- `tapu/server/services/assetSpace.js`
- `tapu/server/services/mintSpaceProfile.js`
- `tapu/server/routes/auth.js`
- `tapu/server/routes/entities.js`
- `tapu/src/views/AssetsPage.vue`
- `tapu/src/views/MintSpacePartnerPage.vue`

### frontend

职责：

- 首页与用户主路径保持成熟、克制、有灵气的现实入口风格。
- 商城是 IP 发现与转化入口，不再保留社区、心愿单和无信息量顶部 tab。
- 商城卡片已拆为组件，页面本体只负责数据编排和动作分发。
- 内容详情支持预览、跳转 Mint Space 接入实体、直接输入 token 写入实体默认内容。
- Mint Space 提供 token 接入、灵境合照、伙伴入口、创作入口、默认内容维护、转赠和解绑；高价值事件留在 OS 历史上下文，不作为 Space 首页列表展示。
- 账户下拉菜单中的 `/assets` 入口对客显示为 Mint Space。
- `/play?key=...` 是 NFC 播放入口。

关键代码：

- `tapu/src/views/LandingPage.vue`
- `tapu/src/views/ShopPage.vue`
- `tapu/src/components/shop/ShopProductCard.vue`
- `tapu/src/views/AssetsPage.vue`
- `tapu/src/views/ShopIpDetailPage.vue`
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

- 官方管理后台：应用范式、IP、订单、申诉、持有记录、站点开关。官方内容通过统一创作中心创建和修改，不再保留独立作品中心或内容集合 CMS。
- 订单录入后视为 token 已发放、NFC 链接已写入，并记录时间。

关键代码：

- `tapu/src/views/official/OrderManage.vue`
- `tapu/src/views/official/ApplicationManage.vue`
- `tapu/src/views/official/AppealManage.vue`
- `tapu/src/views/official/OwnershipManage.vue`
- `tapu/src/views/official/SiteSettings.vue`
## 2026-07-14 Codex Domain Update

### product-flow

- 已用临时 DB + 临时上传目录 + 真实 HTTP 服务复测实体入口主链路：外部订单录入生成 128-bit token，订单可按订单号/token 搜索，NFC 写入与 token 发放时间戳存在，未绑定 token 可设置公开默认内容，绑定后防抢绑，持有人可上传私有内容并设默认，转赠后旧持有人失权、新持有人可修改。
- 产品口径明确：`/play?key=<token>` 通过核心内容解析打开该物件的默认内容；token 只授权当前 IP 实例的默认播放，不提供任意私有内容浏览或管理能力。

### mint-space

- `entity_ownership_events` 是实体传承审计链的核心记录；`content_default_set` 事件必须尽量带上 `token` 与 `order_id`，便于从订单、token、内容变更三个维度追踪。
- Mint Space 的 OS 主路径已收敛到 `/api/assets`：账号下 IP 实例读取、token 认领、解绑、转赠、默认内容读取/写入都走同一份 OS service。

### frontend

- 商城、Mint Space、IP 详情页已继续靠近“邀请新存在 + 现实入口集合”的视觉方向，并保持首页品牌氛围。
- 仍需关注体量：部分官方管理页和 OS 服务超过 500 行。`AssetsPage.vue` 已拆为 Mint Space 编排、composable、组件和独立样式，后续不要再把流程逻辑写回页面文件。
