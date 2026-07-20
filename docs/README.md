# docs 文档地图

本目录保存项目域补充文档和运行产物；协议正文仍以 `archo evo/` 子模块为准。

## 推荐入口

- [business-flow.md](business-flow.md)：当前最重要的接手文档，说明订单-token-实体-内容-NFC 全流程。
- [product-manifesto.md](product-manifesto.md)：产品宣言、品牌气质和设计语言。
- [product-design-principles.md](product-design-principles.md)：新轻应用立项前的产品设计规范和判断卡。
- [content-container-architecture.md](content-container-architecture.md)：内容容器架构和后续兼容攻坚边界。
- [content-collection-app-binding.md](content-collection-app-binding.md)：内容集合和应用绑定的最小协议。
- [whatmint-os-abstraction.md](whatmint-os-abstraction.md)：物体身份、触碰运行时、内容协议和统一事件账本的 OS 抽象雏形。
- [os-capability-map.md](os-capability-map.md)：当前 OS 级能力地图、AR 渲染能力和后续待补足能力。
- [route-permission-principles.md](route-permission-principles.md)：后端接口权限分配原则、权限类型和新增接口检查清单。
- [development-standards.md](development-standards.md)：日常开发执行标准，约束文件拆分、文案放置、样式复用、接口和路由接入方式。
- [engineering-governance.md](engineering-governance.md)：工程治理护栏，包含编码、质量检查、文件体积和新增功能检查卡。
- [v1-architecture-freeze.md](v1-architecture-freeze.md)：第一版架构冻结说明，确认核心对象、OS 主链和后续产品阶段的默认基线。
- [earphone-girl-core-definition.md](earphone-girl-core-definition.md)：耳机小姐作为第一份完整 IP 范式的核心表定义，直接映射 IP、应用、内容模板、资源和关系表。
- [object-event-taxonomy.md](object-event-taxonomy.md)：跨应用物体事件的命名规范和当前事件映射。
- [../SPEC.md](../SPEC.md)：产品北极星。
- [../DOMAINS.md](../DOMAINS.md)：模块分工和代码入口。
- [../develop.md](../develop.md)：阶段状态和验收。
- [../DOCUMENT_INDEX.md](../DOCUMENT_INDEX.md)：项目总文档地图。

## 目录说明

- `business-flow.md`：业务流程、权限规则、数据库关系、E2E 测试结果。
- `product-manifesto.md`：WhatMint 的长期产品调性、设计语言和判断准则。
- `product-design-principles.md`：物件 x 行为 x 意义、时间/空间坐标、OS/应用边界和立项评分卡。
- `content-container-architecture.md`：统一内容容器的架构边界。
- `content-collection-app-binding.md`：内容创作中心与轻应用运行时之间的绑定协议。
- `whatmint-os-abstraction.md`：轻应用共性抽象和平台能力沉淀边界。
- `os-capability-map.md`：OS 能力现状、上传/渲染/事件/上下文能力边界，以及后续补齐清单。
- `route-permission-principles.md`：新增后端接口时如何选择 `public`、`login_required`、`admin_required`、`token_unbound_or_owner`、`entity_owner` 等权限类型。
- `development-standards.md`：开发时的默认执行标准，避免功能完成后再补工程治理。
- `engineering-governance.md`：新增功能和治理冲刺时的质量检查、编码策略、拆分阈值和提交前检查卡。
- `v1-architecture-freeze.md`：第一版产品进入真实搭建阶段时的架构冻结基线。
- `earphone-girl-core-definition.md`：把耳机小姐收束成可直接映射到核心表的第一份 IP 产品范式。
- `object-event-taxonomy.md`：`object_events` 的事件命名、metadata 建议和不做事项。
- `discussions/`：产品 / ADR 讨论沉淀。
- `archo-evo/review/`：项目域复盘运行产物。
- `archo-evo/constraints/`：项目域约束运行产物。

## 注意

- 不要在本目录修改 `archo evo/` 协议规则。
- 如需变更协作协议，请进入 `archo evo/` 子模块并按提案流程处理。
