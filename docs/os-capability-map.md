# WhatMint OS 能力地图

本文记录当前已经沉淀为 OS 的能力、正在接入的能力，以及后续高收益补足项。它服务于一个目标：新 IP 和轻应用优先通过内容定义、应用定义和 OS 能力接入，而不是散落在单个页面或单个业务路由里。

## 当前已具备

### 核心对象与定义驱动

- `users`：账号、登录态、admin / owner 识别。
- `ip_definitions`：IP / 商品 / 实体定义。
- `application_definitions`：应用注册、入口、技能和交互定义的承载对象。
- `content_definitions`：创作模板、内容形态、渲染模板和资源槽位。
- `ip_instances`：用户或官方真正持有/展示的 IP 实例。
- `content_instances`：由创作中心生成的内容资产。
- `resources`：图片、音频、视频、后续 AR 素材等资源资产。
- `events`：高价值事实记录，供后续状态、技能和上下文消费。

### OS 权限与交易边界

- 统一 route permission：`public`、`login_required`、`admin_required`、`token_unbound_or_owner`、`claimable_asset`、`entity_owner`、`content_owner` 等。
- 关键交易已进入契约校验：token 打开、创作资源上传、通过 token 生成内容、官方内容创建、资产读取、资产认领、解绑、转赠、默认内容维护、内容删除。
- handler 只处理业务有效性；登录、owner、admin、token 可编辑性优先由权限层判断。

### OS 资产能力与 Mint Space

- `/api/assets` 是 IP 实例和资产交易的唯一正式 OS 入口；`/api/auth` 只保留身份、账户资料和申诉职责。
- `assetSpace` service 统一负责：账号下 IP 实例读取、token 认领、解绑、转赠、读取/设置实例默认内容、通过 token 设置默认内容。
- `mintSpaceProfile` service 统一负责：根据账号持有的 `ip_instances`、对应 `ip_definitions` 和 `application_definitions` 推导 Mint Space 的伙伴、空间人格轴、氛围、合照布局提示和规则化灵境杂记；前端不再维护第二套 profile fallback。
- `osEntryPrompt` service 统一负责触碰 / 应用入口后的 Space Invitation Prompt：OS 判断登录、绑定状态、展示频率、关闭状态和跳转目标；应用 manifest 只声明展示形式与频率，官方文案集中在 `server/copy/osEntryPrompts.js`。
- `ip_instance_content_links` 约束同一 `ip_instance_id + relation_role` 只能有一个 primary 内容，避免默认体验出现多重业务真相。
- 前端 Mint Space 只通过 `src/api/assets.ts` / `src/api/index.ts` 的资产 helper 访问接口，不在页面或组件里散写请求。
- Mint Space 页面作为 OS 聚合入口，负责灵境合照、伙伴展示、灵境杂记、进入体验、创作中心、商城和伙伴二级管理；`/assets/:instanceId` 是统一伙伴详情页，具体 IP 的表达和渲染继续由应用定义、内容定义与 `/play` 渲染协议承接。
- Mint Space 专项验收见：[Mint Space 新核心验收策略](asset-space-core-verification.md)。
- 对客状态化导航和重构顺序见：[对客体验与 Mint Space 重构规划](customer-facing-experience-plan.md)。

### Mint Studio Shell

- 通过 token / official IP definition / content id 进入创作中心。
- 创作中心从 `content_definitions.authoring_schema_json` 生成流程。
- 官方创作和用户创作使用同一套创作中心，只由权限和 submit action 区分。
- 内容列表只展示 definition-authored 的核心内容资产。
- 创建中草稿由 `studio_authoring_drafts` 保存 Studio shell 快照、当前节点和资源绑定引用；它是支撑状态，不是正式内容资产。
- 已有内容的修改草稿继续使用 `content_instance_versions`，用于发布新版内容。

### OS 资源上传与绑定

- 上传资源统一进入 OS Resource Pipeline。
- 视频上传会转码为浏览器友好的 H.264 MP4，并生成 poster。
- 如果 `content_definitions` 的资源槽声明 `resourceProfile: ar_alpha_overlay` 或 `requiresAlpha: true`，视频会按 AR 透明叠加 profile 输出 WebM VP9 alpha，避免纸巾小狗这类 AR overlay 被普通 MP4 转码丢失透明通道。
- 图片、音频等资源作为 `resources` 资产落表。
- 发布内容时从 `resources` 表水合可信资源，不相信前端拼出的 URL。
- 资源按 `content_definitions` 的 slot / role / type 校验后绑定到 `content_instance_resource_links`。

### OS 内容渲染协议

- 内容定义可以声明 `template.renderer`。
- 当前已支持：
  - `video.fullscreen`：全屏视频播放器，默认静音自动播放，点击开启声音，支持循环或手动重播。
  - `content.blocks`：内容块详情渲染，适合图文音频组合。
  - `ar.camera-overlay`：摄像头背景 + 中心叠加视频/图片的轻量 AR 渲染器。
- `/play/:contentId` 和 `/play?key=<token>` 都通过 OS 内容协议解析，不走单个应用私有播放器。

### 操作、事件、状态雏形

- token touch 会记录 `object.touch` 操作。
- operation pipeline 可以把操作提炼为有意义事件和状态。
- 事件消费、运行上下文和技能匹配已有基础结构，可继续用于 IP 联动。

## 本轮新增：AR 渲染能力

AR 在当前架构里不是新的业务模块，而是 OS 内容渲染器之一。

```text
content_definition.template.renderer = "ar.camera-overlay"
content_definition.authoring_schema.contentShape.slots = video / image
        ↓
Mint Studio 上传资源
        ↓
OS Resource Pipeline 按 slot profile 转码 / 适配 / 落 resources
        ↓
content_instance 绑定资源节点
        ↓
/play 读取 renderer 并请求摄像头
        ↓
摄像头背景 + 资源叠加展示
```

第一版适合测试：

- 纸巾小狗：碰一下 token，打开摄像头，在屏幕中心召唤 2.5D 视频或透明 WebM alpha 叠加层。
- 桌面秘籍：后续可复用同一 renderer，再增加 marker / anchor 配置，把雪山贴近标记位置。

## 待补足能力

### AR / 空间渲染

- Marker tracking：识别贴纸标记后把内容锚定在标记附近。
- 3D model：支持 `.glb` / `.gltf` 模型资源、模型压缩和 `<model-viewer>` / WebGL 渲染。
- AR resource fallbacks：按设备能力继续补 MP4 fallback、图片 fallback 和可配置降级策略。
- Camera permission fallback：用户拒绝摄像头时提供平面预览或引导。

### 内容编辑

- 内容详情页进入创作中心后按 content id 修改资源节点。
- 修改流程应围绕内容节点做替换、删除、插入，而不是回到管理表单。
- 内容版本发布应保留节点级变更记录。
- 创建中草稿目前保存的是资源绑定引用和流程位置；后续可把替换/插入/删除节点也纳入同一套草稿快照协议。

### Runtime Context / Skill

- 标准 Context 快照：event、user、ipInstance、application、recentEvents、states、ownedMintHints。
- Skill matching：应用定义声明订阅事件和技能，OS 负责任务匹配。
- Event consumption：记录某事件被哪个 IP / skill 消费，避免重复触发失控。

### 关系与生态

- IP relation matrix：官方设定的 IP 情感关系、强度、叙事规则。
- Relationship-aware runtime hints：OS 输出“谁和谁有什么关系”，应用只负责表达语气和剧情。
- 商品/IP 详情展示关系设定，但不让关系逻辑散落到商城页面。

### 工程治理

- 继续拆分历史大文件与 OS 服务：`server/services/osPipeline.js`；`AssetsPage.vue` 已收口为 Mint Space 编排层，商城详情已切到 `ShopIpDetailPage.vue`。
- 新 OS 能力必须补契约测试，至少覆盖 manifest、route、renderer 或 permission 的关键闭环。
