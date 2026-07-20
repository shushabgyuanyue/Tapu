# active constraints：codex

更新时间：2026-07-17

## 当前约束

- 后端 `server/**/*.js` 保持 plain JavaScript，不写 TypeScript 语法。
- 平台抽象必须由已验证轻应用倒推，不提前把所有页面、路由和权限统一成重平台。
- 新 OS 能力优先采用 additive seam：双写事件、双协议返回、前端 fallback，避免一次性迁移打断既有体验。
- 内容容器优先集中处理浏览器兼容，轻应用页面只描述内容块和自身仪式感。
- 每次 OS 抽象必须有真实验证信号，至少包含构建、语法检查或真实 API 请求之一。
- 跨应用抽象至少要经过两个应用验证后，才把它视为平台能力候选。
- r5 之后不主动新增 OS 基建层，除非真实新轻应用证明现有协议不够用。

## 本轮新增

- `object_events` 是观察层，不是立刻替代所有业务事件表。
- `objectRegistry` 先服务已经落地的应用 token，等两个以上应用接入后再考虑统一 `/tap/:token` 路由。
- 轻应用页面保留自己的气质和交互仪式，内容展示区逐步迁入 `ContentRenderer`。
- `Content Collection / App Binding` 先作为后端能力存在，不强制迁移旧应用，不提前做完整 CMS。

## 2026-07-16 r6 新增

- 日常开发默认遵循 `docs/development-standards.md`；文件过大时主动拆分、用户侧文案主动进入 `src/copy/*`、相同样式主动收敛到共享变量或公共样式、新接口和新路由主动走现有权限与契约范式，不把工程治理留到功能完成后补做。
- OS 服务只负责身份、权限、触碰协议、内容协议、事件、状态、Skill 匹配和 runtime context；应用自己的故事、角色语气、视觉节奏和交互仪式必须留在应用层。
- 跨应用体验优先走 `object_events -> meaningful_states -> runtimeContext -> app adapter`，不要让一个应用直接读取另一个应用的私有业务表。
- Manifest 中新增 `producesStates` 或 `skills` 时，必须满足 `check:manifests`，并且至少有可见体验或契约测试证明它不是空声明。
- Content Operation 可以先保持薄层，不引入通用规则引擎；只有当两个以上真实应用需要相同编排能力时，才继续上抽。
- 新轻应用接入时先检查 `docs/os-app-boundary.md`，明确哪些是 OS 复用，哪些是应用表达。

## 2026-07-17 r7 新增

- 删除核心内容资产时，要同步检查 seed / backfill / sync 是否会用确定性 id 复活数据；必要时加入 supporting tombstone，而不是只删除主表记录。
- 前端登录态参与列表或权限渲染时必须进入响应式状态，不能只在 computed 中直接读取 localStorage 包装函数。
- 创作中心内容列表只认核心内容资产；旧应用同步出来的 `sourceTable / entries / cards` payload 不能作为新核心列表的兼容展示来源。
