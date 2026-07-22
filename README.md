# WhatMint / tapU

本仓库使用协议仓库 **archo-evo** 作为 `archo evo/` Git 子模块。协议域只维护协作规则；产品、代码和业务说明属于项目域。

## 项目一句话

WhatMint 是一个现实世界 UI 系统：让日常物品在关键生活场景中获得数字表达，补上它原本想表达却无法表达的部分。当前主线是 **IP + 应用 + 实体入口 + 场景**：用户获得实体 token / NFC 入口后，可将内容绑定到实体，碰一下即可播放纸巾小狗或桌面秘境这类已接入新核心的体验，并将这个存在接入自己的 Mint Space。

## 当前业务主线

- 邀请/购买发生在外部平台；本平台只展示 IP 与应用体验、录入外部订单、管理资产关系。
- 一个 token 对应一个实体，token 为 128-bit 随机唯一值。
- token 未绑定账号前，可凭 token 修改实体默认内容。
- token 绑定账号后，只能登录对应账号修改内容、转赠或解绑。
- 转赠支持账号间直接变更所有权；解绑后自行转发 token 存在泄露/抢绑风险。
- 私有内容必须登录对应持有账号才可查看；默认推荐公开内容。

完整流程见：[docs/business-flow.md](docs/business-flow.md)。

## 代码入口

- 前端：`tapu/src`
- 后端：`tapu/server`
- 数据库：`tapu/server/db/index.js`、`tapu/server/db/schema.sql`
- 核心页面：Mint Space `/assets`、内容详情 `/content/:id`、NFC 播放 `/play?key=...`、官方管理 `/official`

## 本地运行

```bash
cd tapu
npm install
npm run dev:server
npm run dev:client
```

生产构建：

```bash
cd tapu
npm run build
npm start
```

## 验证命令

```bash
cd tapu
npm run build
node --check server/db/index.js
node --check server/routes/auth.js
node --check server/routes/videos.js
node --check server/routes/orders.js
node -e "import('./server/db/index.js').then(async (m) => { await m.getDb(); console.log('db ok'); })"
```

## 文档入口

- 北极星：[SPEC.md](SPEC.md)
- 域分工：[DOMAINS.md](DOMAINS.md)
- 文档地图：[DOCUMENT_INDEX.md](DOCUMENT_INDEX.md)
- 开发大纲：[develop.md](develop.md)
- 业务流程：[docs/business-flow.md](docs/business-flow.md)

## Evo 协作协议

协议域在 `archo evo/` 子模块中。修改协议内容请进入子模块按提案流程处理；项目域文档不要直接修改协议域。

常用协议入口：

| 文件 | 路径 |
|------|------|
| 协作协议正文 | [archo evo/README.md](archo%20evo/README.md) |
| 协议北极星 SPEC | [archo evo/SPEC.md](archo%20evo/SPEC.md) |
| 提案 INDEX | [archo evo/INDEX.md](archo%20evo/INDEX.md) |
| 讨论稿索引 | [archo evo/DISCUSSION_INDEX.md](archo%20evo/DISCUSSION_INDEX.md) |

协议自检：

```bash
python "archo evo/archo-check.py"
```
