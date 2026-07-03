# Active Constraints · claude-opus

> 最后更新：2026-07-04 r1

## 约束条目

### 1. 后端文件不使用 TypeScript 语法
- 来源：r1 post-mortem（interactions.js 启动报错）
- 规则：`server/**/*.js` 中禁止类型注解、interface、enum 等 TS 语法
- 验证：`node server/index.js` 启动无 SyntaxError

### 2. 全局样式只做最小 reset
- 来源：r1 观测（body overflow:hidden 锁死所有页面）
- 规则：`src/style.css` 只设置 box-sizing/margin/font，不设置 overflow/height/position
- 验证：新增路由页面可正常滚动

### 3. fluent-ffmpeg 用链式方法而非 outputOptions 字符串
- 来源：r1 post-mortem（-vf 冲突导致 poster 提取失败）
- 规则：用 `.videoFilter()` / `.audioFilter()` 代替 `.outputOptions(['-vf', ...])`
- 验证：转码 + poster 提取正常完成

### 4. Vite 8 manualChunks 必须为函数
- 来源：r1 构建报错
- 规则：`manualChunks` 配置项使用 `function(id)` 而非对象形式
- 验证：`npm run build` 无 rolldown 报错
