# WhatMint / tapU · 模块与分工

## 整体进度快照

| 一级域 | 估计完成度 | 状态 | 备注 |
|--------|------------|------|------|
| product-flow | 90% | 已联调 | 外部订单 -> token -> 实体 -> 内容 -> NFC 播放主链路已通过 E2E |
| auth-asset | 90% | 已联调 | token 绑定、未绑定修改、绑定后账号权限、转赠、申诉解绑已实现 |
| frontend | 88% | 可继续拆分 | 首页黑紫粉风格已延展到资产/内容/商城页，商城卡片已组件化，资产页仍需继续拆 |
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
- `/play?key=...` 是 NFC 播放入口。

关键代码：

- `tapu/src/views/LandingPage.vue`
- `tapu/src/views/ShopPage.vue`
- `tapu/src/components/shop/ShopFilterBar.vue`
- `tapu/src/components/shop/ShopProductCard.vue`
- `tapu/src/views/AssetsPage.vue`
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
