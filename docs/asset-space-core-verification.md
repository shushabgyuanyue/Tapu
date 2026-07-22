# Mint Space 新核心验收策略

本文用于检验原资产模块是否已经完全收敛为新核心驱动的 **Mint Space**。目标不是追求一次性删光所有历史命名，而是确认系统只有一套业务真相、一套权限入口、一套对客叙事。

技术上，OS 仍以 `/api/assets` 管理 IP 实例和资产交易；对客表达上，用户进入的是 Mint Space，而不是资产仓库。

## 1. 验收结论定义

只有同时满足下面条件，才能认为资产模块完成新核心重构：

- 数据真相只来自核心对象：`users`、`ip_definitions`、`application_definitions`、`content_definitions`、`ip_instances`、`content_instances`、`resources`、`events`。
- 资产主接口只以 `/api/assets` 表达；`/api/auth` 只负责身份、账户和申诉，不再承载资产业务主路。
- 资产交易只通过 OS 权限层进入 handler，不在 handler 或前端页面重复写 owner/admin/token 判断。
- 前端 `/assets` 是 Mint Space，不是旧资产列表或展馆；它聚合 IP 实例、默认内容、体验入口、创作入口、事件和状态。
- 用户可见话术全部在 `tapu/src/copy/*`，页面和组件不散写中文文案。
- 资产样式复用 WhatMint 设计变量和共享风格，不另起一套孤立视觉体系。
- 纸巾小狗作为测试 IP 可以从 token、实例、默认内容、AR/视频渲染、创作中心、内容详情和权限边界完整跑通。

## 2. 数据层检查

### 核心对象

- `ip_instances.owner_user_id` 是实体 IP 归属的唯一字段，资产只能归一个用户。
- `ip_instances.token` / `entity_key` 表示同一个 NFC/token 入口，不产生第二套实体身份。
- `ip_instance_content_links` 表示 IP 实例与内容实例关系。
- 同一个 `ip_instance_id + relation_role` 只能有一个 primary 内容，特别是 `owner_default`。
- `content_instances` 只保存内容资产本身，不把实例默认关系复制进去作为第二真相。
- `resources` 只保存资源资产，内容节点通过关系表引用资源。
- `events` 记录高价值事实；支持审计表可以存在，但不能成为资产状态真相。

### 支撑表边界

- `orders` 只描述外部订单录入、token 发放和 NFC 写入，不代表资产归属真相。
- `entity_ownership_events` 只做持有变化审计，不反向决定当前 owner。
- `token_unbind_appeals` 只做申诉流程，不替代解绑事件和 owner 字段。
- 如果存在旧 `entities` 命名，只能作为历史接口或持有记录查询名；新增代码不得继续把它作为核心资产表述。

## 3. 后端接口检查

### 正式资产 OS 入口

必须存在并进入 route contract：

- `GET /api/assets/instances`
- `GET /api/assets/mint-space`
- `POST /api/assets/claim`
- `POST /api/assets/instances/:entityId/unbind`
- `POST /api/assets/instances/:entityId/transfer`
- `GET /api/assets/instances/:entityId/default-content`
- `PUT /api/assets/instances/:entityId/default-content`
- `PUT /api/assets/default-content-by-token`

### 权限要求

- 资产读取使用 `login_required` + `asset:read`。
- token 认领使用 `claimable_asset` + `asset:claim`。
- 解绑、转赠、已绑定实体默认内容维护使用 `entity_owner` + `asset:owner_manage`。
- 通过 token 设置默认内容使用 `token_unbound_or_owner` + `content:entity_default_set`，且只能写入 `published` 内容，避免后台设置成功但 NFC 播放失败。
- handler 只能读取 `req.permission` 的 subject 后执行业务，不重复写登录、owner、admin 判断。

### 旧接口处理

完全新核心的当前状态：

- 前端不再请求 `/api/auth/bind-entity`、`/api/auth/entities`、`/api/auth/unbind-entity`、`/api/auth/transfer-entity`、`/api/auth/content-default*`。
- 后端不再注册旧 `/api/auth/*` 资产接口。
- `/api/auth` 只负责身份、账户资料、申诉等账号域职责；IP 实例交易只通过 `/api/assets`。

## 4. 前端检查

### 页面结构

- `AssetsPage.vue` 只做页面编排。
- `MintSpacePartnerPage.vue` 是单个 IP 实例的 OS 伙伴详情页，路由为 `/assets/:instanceId`。
- 业务状态和动作在 `useAssetSpace`。
- 展示组件在 `components/assets/*`。
- 页面样式在 `styles/assetsSpace.css`。
- 网络请求只通过 `src/api/assets.ts` 或 `src/api/index.ts` 的资产 helper。

### 用户体验

- 未登录进入 `/assets` 显示登录引导，不展示任何用户资产。
- 登录后显示 Mint Space。
- 已拥有用户看到 Mint Space 合照、我的伙伴和清晰的体验 / 创作 / 邀请入口。
- 纸巾小狗实例以伙伴节点展示，点击进入 `/assets/:instanceId`，再处理体验、创作、默认内容、转赠和解绑。
- 未拥有用户看到“Mint Space 尚未点亮”的引导，不展示仓库式空列表。
- 登录后无资产用户直接进入 `/assets` 时，应看到空灵境接入页：可输入 token、可去商城探索，不回退为仓库式空列表。
- 普通 token 绑定只显示“接入 Mint Space”。
- 从内容详情带 `defaultContentId` 进入时，显示“接入并设为默认体验 / 仅绑定实体 IP”的分流。
- token 已绑定但非本人时，前端必须按 OS 权限错误展示“换账号 / 提交申诉”恢复路径，不只显示普通失败 toast。
- 转赠进入当前账号的实体，应在接收方第一次进入 Mint Space 时出现“新存在进入灵境”的确认提示。
- 解绑、转赠必须有防误操作确认。
- 高价值事件作为 OS 历史上下文保留，不进入 Mint Space 首页列表。
- Mint Space profile 只由后端 `mintSpaceProfile` OS service 聚合；前端不再在接口异常时自行推导空间人格和伙伴。

### 话术与样式

- 非管理端中文文案必须在 `src/copy/user.ts`、`src/copy/content.ts`、`src/copy/shop.ts` 等对应文件。
- 不再出现“资产展馆”“展品”等旧页面范式话术，除非是在历史文档说明里。
- Mint Space 页面优先使用 `--wm-*` 和模块内 `--asset-space-*` 变量。
- 如果 Mint Space 样式被首页、用户中心或 IP 详情复用，应抽取共享设计 token 或共享样式。

## 5. 纸巾小狗验收用例

以现有纸巾小狗 IP 实例作为第一轮固定验收样本。

### 核心链路

1. admin 登录。
2. 读取 `/api/assets/instances`，能看到纸巾小狗实例。
3. 读取实例默认内容，返回 `content-tissue-puppy-ar-placeholder` 或当前配置的纸巾小狗默认内容。
4. 打开 `/play?key=<纸巾小狗 token>`，由 OS 内容渲染协议解析，不进入应用私有播放器。
5. 内容 renderer 从内容定义决定，可以在视频与 AR 间切换，不改资产模块业务逻辑。
6. 从 Mint Space 进入 `/mint?key=<token>`，创作中心按纸巾小狗内容定义生成流程。
7. 从内容详情带 `defaultContentId` 跳转 `/assets`，绑定后可设置为该 IP 实例默认内容。

### 权限链路

1. 匿名访问 `/api/assets/instances` 返回 `401`。
2. owner 访问自己的实例默认内容返回 `200`。
3. 非 owner 访问该实例默认内容返回 `403`。
4. 非 owner 设置默认内容返回 `403`。
5. 已绑定 token 被其他账号认领返回 `409`。
6. owner 转赠后，旧 owner 失去默认内容维护权限，新 owner 获得权限。
7. 解绑后 `owner_user_id` 清空，token 可重新绑定。

## 6. 文档统一检查

需要保持一致的文档入口：

- `README.md`：只保留项目介绍、本地运行和关键页面入口。
- `DOMAINS.md`：模块名使用 `mint-space`，不再使用 `auth-asset`。
- `docs/business-flow.md`：业务流程使用 `/api/assets` 和 `ip_instances.owner_user_id`。
- `docs/os-capability-map.md`：记录 `/api/assets` 已沉淀为 OS 资产能力，对客页面表达为 Mint Space。
- `docs/route-permission-principles.md`：资产接口示例使用 `/api/assets`。
- `docs/v1-architecture-freeze.md`：Mint Space 是页面组织范式，不是新核心表。
- `DOCUMENT_INDEX.md`：索引到本验收策略。

检查命令：

```bash
rg -n "auth-asset|资产展馆|展品|entities\\.user_id|/api/auth/(entities|bind-entity|unbind-entity|transfer-entity|content-default)" README.md DOMAINS.md DOCUMENT_INDEX.md docs tapu/src/copy
```

预期：除本验收文档的检查命令或历史复盘外，不应出现旧主路径表达。

## 7. 自动化检查

每轮资产域改动至少执行：

```bash
cd tapu
npm run check:quality
npm run build
```

资产域专项检查：

```bash
cd tapu
npm run check:permissions
npm run test:contracts
```

建议补充的契约测试：

- `/api/assets/*` 关键路由权限和 operation 固定。
- 同一 IP 实例同一 relation role 只能有一个 primary 内容。
- `/play?key=<token>` 解析默认内容时优先 owner default，再回退官方默认。
- 默认内容写入必须拒绝 `draft` / `processing` 内容，只允许 `published` 内容进入 NFC 播放链路。
- 非 owner 无法读取或写入实例默认内容。
- token 认领幂等，已绑定其他账号时防抢绑。

## 8. 执行计划

### Phase 1：盘点和标记

- 搜索前端、后端、文档里的旧资产入口和旧话术。
- 确认旧 auth 资产函数未被调用且未注册。
- 标记仍把资产描述为“展馆 / 展品 / entities”的文档段落。
- 输出待删、待迁、可保留支撑项三类清单。

### Phase 2：主路径收敛

- 前端资产调用全部切到 `/api/assets`。
- `src/api/index.ts` 中旧函数名如需保留，只作为转发到新 OS endpoint 的兼容 helper。
- 后端资产业务规则全部沉到 `assetSpace` service。
- `auth.js` 不再注册资产交易接口。

### Phase 3：页面范式验收

- 用纸巾小狗实例验证 Mint Space 首页、伙伴入口、统一伙伴详情、体验、创作、默认内容维护、转赠和解绑。
- 验证无效 `/assets/:instanceId` 显示缺失态，而不是自动 fallback 到第一位伙伴。
- 检查是否还有机械按钮堆叠、展柜感、旧列表页表达。
- 需要新增交互时优先升级 `components/assets/*`，不把逻辑写回 `AssetsPage.vue`。

### Phase 4：权限和事件验收

- 用 admin、普通 owner、非 owner、匿名四种身份跑资产读写。
- 验证绑定、解绑、转赠、默认内容设置都写入高价值事件或持有审计。
- 验证操作日志不进入内容列表或资产状态真相。

### Phase 5：删除旧结构

- 当前端、测试、文档都不再依赖旧 auth 资产接口后，保持删除旧 handler 和 route contract 的状态。
- 如 `entities` 命名只剩持有审计，应决定是否保留为支持域命名，或改名为 ownership。
- 删除不再可达的旧组件、旧样式、旧 copy 字段和旧测试脚本。

### Phase 6：冻结 Mint Space 范式

- 更新 `DOMAINS.md`、`business-flow.md`、`os-capability-map.md`、`route-permission-principles.md`。
- 在契约测试中固定纸巾小狗 Mint Space 样本。
- 形成“新 IP 接入 Mint Space”的最小开发模板：IP 定义、应用定义、内容定义、默认内容、token 实例、渲染入口。

## 9. 当前下一步建议

下一轮优先做 Phase 1 + Phase 2 的剩余收口：

- 继续补充 `/api/assets` 权限/行为专项契约测试文件。
- 用纸巾小狗在浏览器中跑一遍 Mint Space -> 体验 -> 创作中心 -> 内容详情 -> 回写默认内容。
