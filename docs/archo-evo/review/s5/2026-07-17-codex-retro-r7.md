# 复盘笔记（codex）· r7

日期：2026-07-17
策略：S5

## 项目情况

- 本轮推进：修复 Mint Studio 登录后内容列表不热更新，以及内容删除后被 seed / 旧同步重新创建的问题。
- 本轮也继续收口创作中心的新核心模型：内容列表只承认核心 `content_instances`，旧 `sourceTable / entries / cards` payload 从当前开发库清除，并用删除墓碑阻止复活。
- 事实依据（commit / 文件 / 测试）：`tapu/src/composables/useMintStudioLibrary.ts`、`tapu/src/events/appEvents.ts`、`tapu/server/services/contentAssets.js`、`tapu/server/services/earphoneGirlSeed.js`、`tapu/server/services/coreCreationSync.js`、`tapu/server/db/index.js`、`tapu/server/db/core-schema.sql`。

## 留言给上一轮单兵

- r6 的 OS/App 边界判断是对的，但这轮暴露出一个更细的持久化问题：删除不是“没有数据”，而是一个需要被 seed 和同步器尊重的系统事实。
- 未来如果继续保留本地 demo seed，需要默认设计“不会复活用户删除过的数据”的机制，否则会误伤内容中心、创作中心和官方运营调试。

## 基于事实的建议

- 建议：所有确定性 id 的 seed / sync / bootstrap 写入，都应在写入前检查对应 tombstone 或状态事实。
- 依据：本轮删除旧同步内容后，重启服务仍可因旧同步 upsert 复活内容；加入 `content_instance_deletions` 后，`syncAnswerBookDeckContent` 返回 `null`，耳机小姐 seed 也不会复活带墓碑的内容。
- 建议：前端全局登录态不要直接用非响应式 localStorage 查询参与 computed 渲染。
- 依据：`mintedItems` 在未登录分支没有订阅内容列表数据，导致登录后即使 fetch 完成也可能不刷新可见列表。

## [SELF-CONSTRAINT]

- 认知沉淀：删除核心对象时，要区分“物理删除”和“防止系统重建的事实记录”；有 seed / backfill / sync 的地方尤其需要 tombstone。
- 行为修正：以后改内容资产删除链路时，同步检查 seed、backfill、sync、列表查询四个方向，而不只看 DELETE handler。
- 验证信号：除了 `npm run check:quality` 和 `npm run build`，涉及数据复活问题时必须增加重启/seed/sync 级别的手动或脚本验证。
