# 复盘笔记（codex）· r9

日期：2026-07-22
策略：S5

## 项目情况

- 本轮推进：修复对客商城和首页仍可能暴露非当前 IP 的问题，商城页面直接从搜索筛选开始，不再用无信息量的顶部卡片稀释入口心智。
- 本轮也把历史 seed / 管理数据从“前端过滤”升级为“启动清理并落盘”：当前核心应用和 IP 定义只保留纸巾小狗、桌面秘境，旧 `groups / series` 管理行清空。
- Mint Space 合照改为主视觉资产，分享图优先使用真实合照，并补充官方组合合照资源规范。
- 移动端完成两处高收益体验治理：顶部导航改为折叠菜单，Mint Studio 移动侧栏遮罩不再盖住侧栏。
- 事实依据（commit / 文件 / 测试）：`tapu/server/services/retiredProducts.js`、`tapu/server/db/index.js`、`tapu/src/views/ShopPage.vue`、`tapu/src/components/NavBar.vue`、`tapu/src/composables/useAssetSpace.ts`、`docs/mint-space-collage-assets.md`、`npm run check:quality`、`npm run build`。

## 留言给上一轮单兵

- 这轮最重要的修正是不要把“旧数据不展示”当成清理完成。WhatMint 现在已经进入按 manifest 接入轻应用的阶段，非 manifest 产品数据留在管理表里也会污染判断。

## 基于事实的建议

- 建议：后续下线轻应用时，同步处理 manifest、核心定义、内容、实例、关系链接、旧管理表和 checked-in dev DB，不要只删路由或前端入口。
- 依据：本轮核心商城查询已干净，但旧 `groups` 表仍残留“烫游鹅”等管理数据，说明旧后台数据会成为第二套事实。
- 建议：Mint Space 合照正式产品化前，先落地静态资源 manifest，而不是直接做完整官方管理 UI。
- 依据：当前只需要组合 key、图片 URL、分享图、描述和人格标签即可支撑前端展示；过早做后台会把资源生产流程复杂化。

## [SELF-CONSTRAINT]

- 认知沉淀：对客模块只认当前核心 manifest 和核心对象；历史 seed、旧管理行、旧路由兼容数据都不能作为隐藏兜底。
- 行为修正：以后遇到“不存在的 IP 还展示”，先查 DB/source route/seed/long-running process 四层，不先做前端过滤。
- 验证信号：至少运行核心表查询、`npm run check:quality` 和 `npm run build`；如浏览器还显示旧数据，区分磁盘 DB 与已启动服务内存。
