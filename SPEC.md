# WhatMint / tapU · 项目北极星

> 协议域北极星见 `archo evo/SPEC.md`。本文件只描述项目域产品方向。

## 一句话

WhatMint 是一个自营的现实世界 UI App：让日常物品在关键生活场景中获得数字表达，补上它原本想表达却无法表达的部分。

实现上，WhatMint 通过 NFC、token、IP 定义、应用定义、内容定义和 OS 渲染能力，把现实实体变成一个个可触碰的场景入口。

## 当前优先级

第一阶段优先打磨 **一物一场景一魔法** 的闭环，例如纸巾小狗和桌面秘境：

- 一个 IP 默认绑定一个应用、一个实体入口和一个具体生活场景。
- IP 不做大而全功能；完整生活场景由多个精准 IP 共同营造。
- 让用户第一次触碰实体时，就感到“这个物终于能表达它想表达的东西”。
- 通过 token + 内容绑定，让同一实体可持续更新数字表达。

## 稳定原则

- **NFC 是入口，不是产品本身**：核心价值在实体、场景和数字表达。
- **Mint Space 是拥有后的默认目的地**：用户最终不是管理资产，而是拥有一组属于自己的现实入口。
- **实体是存在的载体**：一个 token 对应一个实体，所有权、内容和体验都围绕这个实体展开。
- **内容是表达的延展**：视频、AR、清单、回应、留言和纪念内容都通过统一内容协议接入。
- **默认公开，私有慎用**：公开内容体验最顺；私有内容必须登录持有账号查看。
- **外部购买，WhatMint 管接入与体验**：第一版不承担站内交易闭环，只管理 IP 展示、订单-token-实体关系、内容绑定、触碰体验和 Mint Space 接入。
- **当前阶段保持自营闭环**：轻应用是 WhatMint 内部功能入口；联名先作为场景 IP 的视觉、话术和资源表达接入，不做开放第三方平台。

## 产品气质

WhatMint 的设计语言以 [docs/product-manifesto.md](docs/product-manifesto.md) 为准。

核心调性：

- 有灵气，有个性，歌颂美好，同时成熟克制，兼具商业性。
- 让现实物体拥有克制而有灵气的数字生命。
- 碰一下，让物体以自己的方式回应你。

## 当前非目标

- 不在平台内完成支付/购买。
- 不提前做重社区。
- 不把 Mint Space 做成任务、等级、抽卡或数值成长系统。
- 不把应用技术层暴露给普通用户。
- 不让 token 成为可遍历或可猜测的短码。

## 指针

- 业务流程与权限规则：[docs/business-flow.md](docs/business-flow.md)
- 对客体验与 Mint Space 规划：[docs/customer-facing-experience-plan.md](docs/customer-facing-experience-plan.md)
- OS 抽象雏形：[docs/whatmint-os-abstraction.md](docs/whatmint-os-abstraction.md)
- 模块与分工：[DOMAINS.md](DOMAINS.md)
- 阶段与验收：[develop.md](develop.md)
- 文档地图：[DOCUMENT_INDEX.md](DOCUMENT_INDEX.md)
