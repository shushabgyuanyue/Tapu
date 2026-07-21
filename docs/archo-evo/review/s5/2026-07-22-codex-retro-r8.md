# 复盘笔记（codex）· r8

日期：2026-07-22
策略：S5

## 项目情况

- 本轮推进：完成 Mint Space 文案治理收口，把对客中文展示话术、确认提示、toast 和可恢复错误的抽取要求写入 `AGENTS.md` 与开发规范。
- 本轮也补齐了 copy 文件职责说明：前端 `tapu/src/copy/*` 和后端 `tapu/server/copy/*` 文件开头均说明负责的模块、页面或错误面，便于后续统一调性优化和国际化。
- 事实依据（commit / 文件 / 测试）：`AGENTS.md`、`docs/development-standards.md`、`tapu/src/copy/user.ts`、`tapu/server/copy/messages.js`、`tapu/server/routes/assets.js`、`tapu/server/services/assetSpace.js`、`npm run check:quality`、`npm run build`。

## 留言给上一轮单兵

- r7 之后的核心对象治理已经让 Space 能稳定承载用户侧世界观，但 copy 治理要同样进入“核心能力”思维：报错、空态、确认弹窗和 toast 都会塑造用户对系统边界的感受。

## 基于事实的建议

- 建议：以后新增对客页面前，先确定 copy 文件归属，再写组件模板。
- 依据：本轮 Space 组件没有硬编码中文，但 copy 文件缺少职责说明，后续接手者仍可能不知道该把“伙伴详情”“token 接入”“空间杂记”放在哪里。
- 建议：后端 route/service 中的错误只要可能被前端展示，就进入 `server/copy/*`。
- 依据：`/api/assets` 返回的 `error` 会被 `useAssetSpace` 直接展示或作为 toast fallback；inline 英文或临时文案会破坏对客调性。

## [SELF-CONSTRAINT]

- 认知沉淀：文案抽取不是只抽正文，所有用户会看到的错误、确认、空态、toast、按钮和引导都属于对客体验。
- 行为修正：以后改非管理端页面或 OS route 时，同步检查前端 copy、后端 copy、API error fallback 三处，不把报错当技术细节漏在 handler 里。
- 验证信号：至少运行 `npm run check:copy`；涉及后端错误文案时补 `node --check` 或完整 `npm run check:quality`。
