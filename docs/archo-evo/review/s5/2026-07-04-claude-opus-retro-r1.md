# 复盘笔记（claude-opus）· r1

日期：2026-07-04
策略：S5

## 项目情况

- 本轮推进：完成 Phase 3 产品化全部代码交付
  - 官网首页：whatmint 品牌落地，永远系列 IP 展示，消费者/创作者双向价值主张
  - 社区发现页：视频卡片 feed + 点赞/收藏/分享 + 二创入口（预留）
  - 播放器：上滑切换同组视频 + 双击设为默认 + 桌面滚轮支持
  - 后端：社交互动 API（interactions + defaults + popular + siblings + batch）
  - 管理端：拖拽上传 + 分组弹窗 + 转码状态轮询 + 顶部导航响应式
  - 基建：全局 CSS 修复、R2 服务代码、Vercel 部署配置

- 事实依据：
  - `npm run build` 通过，所有页面独立 code-split
  - `node server/index.js` 启动无报错
  - 新增文件：interactions.js, r2.js, CommunityPage.vue, LandingPage.vue, BarChart.vue, DateRangePicker.vue, admin.css, vercel.json
  - 修改文件：23 个（含 schema、路由、样式、配置）

## 留言给上一轮单兵

- 后端文件（server/ 下的 .js）不经过 TypeScript 编译器，绝对不能写类型注解。这一点在快速迭代时容易遗忘。
- 全局样式文件（style.css）中的限制性属性（overflow:hidden, fixed height）会在路由引入后影响所有页面。建议任何全局样式只做最小 reset，页面级限制由组件自行管理。
- fluent-ffmpeg 的 API 存在多种写法（outputOptions vs 链式方法），它们之间可能冲突。推荐统一使用链式方法（.videoFilter / .audioFilter）而非 outputOptions 字符串。

## 基于事实的建议

- 建议：下一轮优先做 NFC 真机端到端测试（Android NFC → URL → 播放器 → 滑动切换），这是产品核心路径，目前仅在浏览器验证。
- 依据：所有交互逻辑（touch/wheel/双击）已实现，但 NFC tag 写入 → 手机识别 → 浏览器打开的链路未验证。
- 建议：R2 对接建议在部署环境（Railway/Vercel）中配置，本地开发保持 local fallback 即可。
- 依据：r2.js 已有 `isR2Configured()` 判断，transcode.js 在 R2 未配置时回退本地存储。

## [SELF-CONSTRAINT]

- 认知沉淀：后端代码生成时必须检查运行时环境（Node.js 原生运行 vs tsc 编译），避免混入类型注解。
- 行为修正：全局样式修改前先 grep 所有引用该属性的页面，评估影响范围。
- 验证信号：`node server/index.js` 能无报错启动 = 后端无语法问题；所有页面可正常滚动 = 全局 CSS 无副作用。
