# 文档索引与项目总览

> 本文件是项目域文档地图；协议域索引在 `archo evo/` 子模块内维护。

## 1. 本项目是什么

WhatMint / tapU 是一个通过 NFC 将实体与情绪内容绑定的系统。当前阶段聚焦情绪 IP 类实体：外部购买实体后，官方录入订单并生成 token，用户将内容绑定到实体，碰一下 NFC 即可播放对应内容。

## 2. 必读顺序

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [SPEC.md](SPEC.md) | 产品北极星和稳定原则 |
| 2 | [docs/product-manifesto.md](docs/product-manifesto.md) | 产品宣言、品牌气质和设计语言 |
| 3 | [docs/product-design-principles.md](docs/product-design-principles.md) | 新轻应用立项前的产品设计规范和判断卡 |
| 4 | [docs/whatmint-os-abstraction.md](docs/whatmint-os-abstraction.md) | 物体身份、触碰运行时、内容协议和统一事件账本 |
| 5 | [docs/route-permission-principles.md](docs/route-permission-principles.md) | 后端接口权限分配原则和新增接口检查清单 |
| 6 | [docs/content-collection-app-binding.md](docs/content-collection-app-binding.md) | 内容集合和应用绑定最小协议 |
| 7 | [docs/object-event-taxonomy.md](docs/object-event-taxonomy.md) | 跨应用物体事件命名规范 |
| 8 | [docs/business-flow.md](docs/business-flow.md) | 完整业务流程、权限规则、数据库关系、E2E 结果 |
| 9 | [DOMAINS.md](DOMAINS.md) | 模块分工和代码入口 |
| 10 | [develop.md](develop.md) | 阶段状态、验收和后续高收益事项 |
| 11 | [README.md](README.md) | 本地运行和验证命令 |

## 3. 代码入口索引

| 方向 | 入口 |
|------|------|
| 后端 API | `tapu/server/routes/*` |
| 数据库 | `tapu/server/db/index.js`、`tapu/server/db/schema.sql` |
| 前端页面 | `tapu/src/views/*` |
| API 封装 | `tapu/src/api/index.ts` |
| 官方后台 | `tapu/src/views/official/*` |
| 上传与存储 | `tapu/server/services/transcode.js`、`tapu/server/services/storage.js`、`tapu/server/services/r2.js` |

## 4. 协议域

- 协议子模块：`archo evo/`
- 四锚点备忘：[PROTOCOL-ANCHORS.md](PROTOCOL-ANCHORS.md)
- 不要在项目域提交中修改协议域规则，除非明确进入协议提案流程。

## 5. 历史/运行产物

- 项目复盘与约束：`docs/archo-evo/review/`、`docs/archo-evo/constraints/`
- 产品讨论：`docs/discussions/`
