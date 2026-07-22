# Design System Governance

本文档定义 WhatMint 前端设计语言的工程治理方式。目标是让后续更换品牌风格、页面气质或主题语言时，优先修改 design tokens 和共享基座，而不是逐页重写样式。

## 分层模型

### 1. Primitive Tokens

位置：`tapu/src/styles/design-system.css`

负责最基础的视觉原料：

- 字体：`--wm-font-*`
- 文本颜色：`--wm-ink`、`--wm-muted`
- 基础背景：`--wm-canvas`、`--wm-canvas-warm`
- 品牌色：`--wm-accent`、`--wm-warm`、`--wm-rose`
- 圆角：`--wm-radius-*`
- 阴影：`--wm-shadow-*`
- 动效：`--wm-duration-*`、`--wm-ease-standard`

Primitive token 不直接表达业务语义，只表达可复用视觉原料。

### 2. Semantic Tokens

位置：`tapu/src/styles/design-system.css`

负责把视觉原料映射成产品语义：

- 页面背景：`--wm-page-bg`
- 面板：`--wm-panel-bg`、`--wm-panel-border`、`--wm-panel-radius`、`--wm-panel-shadow`
- 主按钮：`--wm-action-primary-bg`、`--wm-action-primary-color`
- 次按钮：`--wm-action-secondary-*`
- 标签：`--wm-chip-bg`、`--wm-chip-color`
- 弹窗遮罩：`--wm-modal-backdrop`

未来换风格时，优先改 semantic token。

### 3. Shared Base Classes

位置：`tapu/src/styles/design-system.css`

负责跨页面基础结构：

- `.wm-page`
- `.wm-shell`
- `.wm-section`
- `.wm-panel`
- `.wm-action-row`
- `.wm-btn-primary`
- `.wm-btn-secondary`
- `.wm-btn-ghost`
- `.wm-chip`
- `.wm-empty`
- `.wm-spinner`
- `.wm-modal-backdrop`
- `.wm-modal-panel`

新增页面应先组合这些基座类；页面专属 CSS 只写业务差异。

### 4. Shared Components

位置：`tapu/src/components/common/*`

负责把常见交互收成稳定组件：

- `WmButton.vue`：全站按钮入口，承接 primary、secondary、ghost、danger、inverse、glass 等变体。
- `WmLoading.vue`：加载动画入口，承接普通页面和播放页的加载状态。
- `WmState.vue`：空态、错误态和恢复入口。

对客页面、OS 播放页、NFC 触碰页和通用弹窗默认使用这些组件。页面不应再各自定义一套 `.primary-action`、`.error-btn`、`.replay-btn` 的完整视觉系统；如果确实需要新变体，先扩展 token 和基础组件。

### 5. Module Styles

位置：`tapu/src/styles/*.css` 或组件 `<style scoped>`

负责模块差异化表达，例如：

- Mint Space 合照布局
- Studio 对话流密度
- Shop 商品卡视觉节奏
- 轻应用自己的仪式感

模块样式可以定义局部变量，但必须从全局 token 延展。

## 新页面接入规范

新建非管理端页面时，默认结构：

```vue
<template>
  <div class="feature-page wm-page">
    <NavBar />
    <main class="feature-shell wm-shell">
      ...
    </main>
  </div>
</template>
```

页面背景不要直接写大段渐变。需要差异化时：

```css
.feature-page {
  --wm-page-bg: var(--wm-page-gradient-soft);
}
```

按钮、加载和错误态默认写法：

```vue
<WmButton variant="primary">主要动作</WmButton>
<WmLoading />
<WmState title="无法加载" body="请稍后重试" action-label="返回" />
```

## 禁止项

- 新页面直接写一套独立的 hex 色板。
- 在多个页面重复定义按钮、标签、面板、弹窗和 loading 样式。
- 页面背景使用硬分割色块，除非该页面有明确产品理由。
- 轻应用为了表达个性而绕过基础触控尺寸、focus、disabled、loading 和移动端规则。
- 播放页、NFC 触碰页、错误页另写独立按钮和 loading 视觉，导致真实体验和普通页面割裂。

## 迁移策略

- 新页面：必须使用 `.wm-page`、`.wm-shell` 和至少一类共享基座。
- 正在触达的旧页面：顺手迁移页面背景、shell、按钮、panel、modal 或 loading 中的一类。
- 大页面：先迁移 token 和公共类，不急于一次性重构 DOM。
- 特殊视觉页：保留表达自由，但需要在局部变量中引用全局 token。

## 验证方式

每轮视觉或前端治理至少检查：

- 是否新增了不必要的硬编码颜色。
- 是否可以通过替换 token 改变主风格。
- 移动端是否出现横向滚动。
- focus、hover、disabled、loading 是否沿用统一反馈。
- `/play` 的加载、错误、重播、开声和 OS 入口提示是否仍沿用共享组件。
- `npm run check:quality`
- `npm run build`

## 当前样板

当前优先样板页面：

- Shop：发现与转化入口，使用统一页面背景、筛选、卡片、按钮语义。
- Mint Space：个人空间入口，使用统一页面背景和移动端 shell，保留合照表达自由。
- Mint Studio：创作操作入口，使用统一页面背景、侧栏开关和内容详情维护密度。
