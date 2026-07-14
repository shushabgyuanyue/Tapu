# active constraints：codex

更新时间：2026-07-14

## 当前约束

- 后端 `server/**/*.js` 保持 plain JavaScript，不写 TypeScript 语法。
- 平台抽象必须由已验证轻应用倒推，不提前把所有页面、路由和权限统一成重平台。
- 新 OS 能力优先采用 additive seam：双写事件、双协议返回、前端 fallback，避免一次性迁移打断既有体验。
- 内容容器优先集中处理浏览器兼容，轻应用页面只描述内容块和自身仪式感。
- 每次 OS 抽象必须有真实验证信号，至少包含构建、语法检查或真实 API 请求之一。
- 跨应用抽象至少要经过两个应用验证后，才把它视为平台能力候选。

## 本轮新增

- `object_events` 是观察层，不是立刻替代所有业务事件表。
- `objectRegistry` 先服务已经落地的应用 token，等两个以上应用接入后再考虑统一 `/tap/:token` 路由。
- 轻应用页面保留自己的气质和交互仪式，内容展示区逐步迁入 `ContentRenderer`。
