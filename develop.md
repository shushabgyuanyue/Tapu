# 开发大纲

## 0. 文档分工

| 你想了解 | 读 |
|----------|-----|
| 产品方向 | [SPEC.md](SPEC.md) |
| 完整业务流程 | [docs/business-flow.md](docs/business-flow.md) |
| 模块分工 | [DOMAINS.md](DOMAINS.md) |
| 文档地图 | [DOCUMENT_INDEX.md](DOCUMENT_INDEX.md) |
| 本地运行 | [README.md](README.md) |

## 1. 研发原则

1. **实体优先**：功能围绕 token/entity 设计，而不是围绕一次性链接。
2. **公开默认**：公开内容是最顺滑体验；私有内容必须登录持有账号。
3. **购买外置**：平台不做交易，只做商品展示、订单-token-实体关系管理。
4. **权限先行**：官方管理必须 admin-only；资产操作必须遵守 token 绑定状态。
5. **移动优先**：NFC 入口主要发生在手机端，播放页与绑定页必须手机友好。
6. **只做高收益优化**：社区、应用生态、订单买家模型等在主链路稳定后再扩展。

## 2. 阶段状态

### Phase 1: 播放与上传基础 ✅

- Vue 3 + Vite 前端。
- Express 后端。
- 视频上传、FFmpeg 转码、封面提取。
- `/play/:id` 和 `/play?key=...` 播放入口。

### Phase 2: 商品/IP/内容管理 ✅

- 系列、IP、内容管理。
- 首页品牌展示。
- 商城独立页面。
- 社区和心愿单作为可关闭模块。

### Phase 3: 资产 OS 主链路 ✅

- 外部订单录入。
- token 生成与 NFC 链接发放。
- token 绑定账号。
- 未绑定 token 修改公开默认内容。
- 绑定后账号权限控制。
- 内容上传可绑定 token 并设为默认。
- 私有内容仅持有人/admin 可查看。
- 转赠、申诉解绑、持有记录。
- 应用技术层：`applications -> series -> groups -> entities`。

### Phase 4: 上线前重点

- 真机 NFC 写入与扫码/碰触体验确认。
- R2 存储 + CDN 真实配置。
- 官方订单操作 SOP。
- 私有内容在未登录场景下的前端提示优化。

## 3. 当前已验收主流程

2026-07-13 已用临时数据库、临时上传目录、真实后端 HTTP 完成 E2E 验证：`42/42 PASS`。

覆盖：

- 外部订单录入生成 token。
- 未绑定 token 设置默认内容。
- NFC 播放公开默认内容。
- 账号绑定后匿名修改被拒。
- 持有人上传私有内容并设默认。
- 匿名 NFC 不返回私有内容。
- 登录持有人可播放私有默认内容。
- 转赠后权限变更。
- 申诉解绑后可重新绑定。
- 持有记录与订单交付字段可查询。

详细说明见：[docs/business-flow.md](docs/business-flow.md)。

## 4. 常用验证

```bash
cd tapu
npm run build
node --check server/db/index.js
node --check server/routes/auth.js
node --check server/routes/videos.js
node --check server/routes/orders.js
node -e "import('./server/db/index.js').then(async (m) => { await m.getDb(); console.log('db ok'); })"
```

如需验证全新数据库：

```powershell
cd tapu
$tmp = Join-Path $env:TEMP ('whatmint-test-' + [guid]::NewGuid().ToString() + '.db')
$env:DB_PATH = $tmp
node -e "import('./server/db/index.js').then(async (m) => { await m.getDb(); console.log('fresh db ok'); })"
Remove-Item -LiteralPath $tmp -Force
```

## 5. 后续高收益事项

- R2/CDN 真实接入和线上视频加载验证。
- 真机 NFC 链接写入、iOS/Android/微信环境播放体验测试。
- 外部订单真实买家字段建模，例如 `external_buyer_ref`、`external_platform`。
- 资产页组件化拆分，降低后续维护成本。
- 私有内容匿名 NFC 场景增加更明确的登录提示。

## 6. 暂不建议优先做

- 平台内支付。
- 大社区功能。
- 用户侧暴露应用技术层。
- 复杂实时聊天或消息提醒。
