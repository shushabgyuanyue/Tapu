# S5 Observation & Retro - R2

**Date:** 2026-07-04
**By:** gemini-cli
**Branch:** tapu-master

## 1. 冲刺目标完成度
本次 L3 单兵冲刺跨越了前端产品化、后端加密鉴权架构、以及底层转码调优三个层面：
- **转码与兼容性**：完美修复了因缺少 `yuv420p` 像素格式配置导致的部分移动端浏览器无法播放视频（仅显封面）的恶性 Bug。同时，将压缩等级上调至 `crf 28` 搭配 `fast` 预设，显著缩减了成品大小。
- **动效防抖与前端防误触**：全面重构了 `PlayerView.vue`。用 `slide-up` 的原生 `<transition>` 解决了过往暴力替换 src 带来的断裂感。新增了 `250ms` 判定边界，明确区分了防误触上下滑动、解音单击与点赞双击。
- **账号与电商重构**：从零构建了基于 `AES-256-CBC` 的对称加密登录凭证。重写了 `schema.sql` 库表，确立了 `users`（母账户） -> `series` / `groups` -> `entities`（选购实体子账户）的三级模型。私有视频增加了严格的实体归属权（entity_id）校验拦截。
- **视觉心智产品化**：深度执行了 Mobile-First 与 MUJI+泡泡玛特的治愈美学。LandingPage 完全蜕变为“大图滑动交互”与“强情感文案”结合的商业转化页，并彻底剔除了原系统全站廉价的 Emoji，改为精美的高定纯色 SVG 图标，全面打通创作者社区导流。

## 2. 踩坑与发现 (Post-Mortem / Fix')
1. **Vue `<transition>` 规则与编译阻断**
   - **现象**：`[plugin:vite:vue] v-else/v-else-if has no adjacent v-if`。
   - **根本原因**：将带有 `v-if` 的节点包裹进 `<transition>` 标签后，紧跟在 `<transition>` 之后的 `v-else` 失去了同层级相邻关系，引发 Vite 构建时编译器错误。
   - **解决路径**：摒弃 DOM 树结构复杂的 `v-else` 连写，改为具有同样表现的 `v-if="!state"` 独立判断。
2. **后端无 default 导出的引用崩溃**
   - **现象**：Node 启动提示 `SyntaxError: The requested module ... does not provide an export named 'default'`。
   - **根本原因**：在批量重构时自动生成了 `import db from '../db/index.js'`，而项目本身的 sql.js 实现采取的是按需的析构式 `export async function getDb()` 且不包含 `default`。
   - **解决路径**：修复引用声明为 `import { getDb } from` 并配合 `await` 进行安全的异步执行。
3. **PowerShell 环境与并发脚本的挂起**
   - **现象**：在 Windows 终端中使用 `node index.js & vite` 会导致奇怪的控制流阻断或者端口（3001）遗留挂起导致 EADDRINUSE。
   - **防范策略**：调试时优先手工独立跑服务，或在开发层接入更稳妥的并发管理包。

## 3. 下一步建议
1. 环境变量层：落实 R2 存储（Cloudflare API Token 的注入验证）。
2. 用户体验：当有了母账号，可以考虑加入一个简单的手机号验证码注册，目前是纯演示期的 uuid() 生成模式。
3. NFC 硬件链联调：打通实体标签的写卡逻辑与带参 URL 的扫码直达流程。