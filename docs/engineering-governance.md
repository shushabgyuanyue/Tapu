# Engineering Governance

这份文档约束 WhatMint 后续工程演进的基本做法。它不追求一次性重构完所有历史包袱，而是保证每一轮新增能力都不会继续把系统推向失控。

## 核心原则

- 入口稳定，内部可拆：页面和业务仍从 `src/api/index.ts` 等稳定入口导入能力，内部按领域拆成小模块。
- OS 能力优先沉淀：请求、权限、内容容器、上传、创作流、文案、样式 token 等共性能力不要散落在单个应用页面里。
- 应用保持克制：轻应用只表达一个清晰场景，复杂的路由、权限、绑定、内容资产关系由 OS 层承接。
- 小步治理：每轮优先处理高收益、低耦合的拆分，不为了“看起来整洁”做大范围行为重写。
- 可验证再提交：工程治理类改动必须至少通过编码检查、服务端语法检查、文件体积检查和前端构建。

## 质量检查

在 `tapu/` 目录执行：

```bash
npm run check:quality
npm run build
```

`check:quality` 包含：

- `check:encoding`：从仓库根目录检查 UTF-8、BOM 和常见中文乱码模式。
- `check:terminal`：初始化并诊断当前 PowerShell UTF-8 显示状态，用来区分“终端误读”和“文件真的坏了”。
- `check:server`：对 `server/**/*.js` 执行 `node --check`，避免纯 JS 后端混入 TS 语法。
- `check:size`：报告超过 500 行的前后端目标文件；默认只提示，`STRICT_ARCH=1` 时超过 900 行会失败。

## 文件体积规则

- 500 行以上：进入观察清单，新增代码时优先考虑提取组件、服务、配置或文案。
- 900 行以上：进入硬债清单，除紧急修复外，不建议继续堆功能。
- API 聚合文件：只做兼容出口和少量基础领域，新增轻应用接口应优先进入独立模块，再由总入口 re-export。
- 页面文件：优先按“容器页面、展示组件、交互 composable、文案配置”拆分，而不是只按 DOM 片段拆分。

## 编码规则

- 仓库文本文件统一 UTF-8、LF、无 BOM，规则由根目录 `.editorconfig` 与 `.gitattributes` 固化。
- 看到 PowerShell 输出中文乱码时，不先判断文件损坏；优先用 `npm run check:encoding` 或编辑器 UTF-8 模式确认。
- 在 Windows PowerShell 中需要长期查看中文文档时，进入 `tapu/` 后先执行 `. .\scripts\use-utf8-terminal.ps1`。注意前面的点号会把设置应用到当前 shell；如果只用 `npm run check:terminal`，它只能诊断子进程。
- 临时读取中文文件时使用 `Get-Content -Encoding UTF8 <path>`，不要依赖 Windows PowerShell 5.1 的默认编码猜测。
- 不要用系统默认编码重新保存中文文档、seed、文案配置和 `.ledger`。
- 如果检查发现 mojibake，先判断是否可逆恢复；不确定时保留原文件并单独记录，不做猜测式批量替换。

## 新增功能检查卡

- 新接口是否已经接入 OS 级权限注册，而不是在业务 handler 内散写鉴权。
- 新文案是否进入对应 copy 模块，而不是直接写在非管理端页面里。
- 新应用是否复用内容资产、Mint Studio、上传、预览、绑定等公共能力。
- 新样式是否复用现有设计 token 或模块级样式，而不是引入孤立视觉语言。
- 新文件是否会让已有大文件继续膨胀；如果会，先拆再加。
