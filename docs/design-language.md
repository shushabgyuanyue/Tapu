# WhatMint Design Language

WhatMint 的视觉语言服务于同一个产品判断：邀请有灵的存在进入生活，并逐渐形成用户自己的 Mint Space。界面不应该抢走物件本身的主角位置，而应该像一层安静、灵敏、可信的光，把触碰后的空间打开。

## Design Temperament

- 有灵气：界面可以有微妙的光、纹理、动效和留白，但不堆砌装饰。
- 有个性：每个轻应用可以拥有自己的情绪色、背景和节奏，但骨架、按钮、卡片、输入框和导航反馈保持统一。
- 歌颂美好：视觉默认温暖、明亮、可亲近，避免冷冰冰的工具感。
- 成熟克制：不滥用高饱和渐变、厚重阴影和过度动画；信息层级要清楚，交互要轻。
- 兼具商业性：购买、铸造、收藏、管理等关键路径要稳定、清晰、可信，不能只追求诗意。

## Token First

新增样式优先使用 `tapu/src/styles/design-system.css` 中的 token：

- 字体：`--wm-font-sans`、`--wm-font-mono`
- 文本：`--wm-ink`、`--wm-ink-soft`、`--wm-muted`、`--wm-faint`
- 背景：`--wm-canvas`、`--wm-canvas-warm`、`--wm-surface`
- 边界：`--wm-line`、`--wm-line-soft`
- 品牌色：`--wm-accent`、`--wm-warm`、`--wm-rose`、`--wm-gold`
- 圆角：`--wm-radius-sm` 到 `--wm-radius-xl`
- 阴影：`--wm-shadow-xs` 到 `--wm-shadow-md`
- 动效：`--wm-duration-*`、`--wm-ease-standard`

页面允许定义自己的局部变量，例如 `--trail-accent`，但应该从全局 token 延展，而不是重新发明一套视觉系统。

## Shared Components

已有公共类：

- `.wm-surface`：通用卡片/容器质感。
- `.wm-focusable`：统一 focus 反馈。
- `.wm-btn-primary`：主要行动按钮。
- `.wm-chip`：筛选和轻选择。
- `.wm-empty`：空状态。
- `.wm-spinner`：加载状态。
- `.wm-kicker`：小型上标题。

新增页面优先组合这些类；如果不够用，再补充新的公共类，而不是在页面里反复复制按钮、卡片、输入框样式。

## Application Freedom

统一不等于所有应用长得一样。

轻应用可以变化：

- 情绪色
- 背景氛围
- 插画/轨迹/卡片表现
- 进入和完成动效
- 文案语气

轻应用应该统一：

- 字体系统
- 信息密度
- 圆角尺度
- 阴影尺度
- 表单和按钮反馈
- 错误、加载、空状态
- 移动端可触控尺寸

## New UI Checklist

Before adding a new page or component:

1. Can the layout use existing page, surface, button, chip, empty, or focus tokens?
2. Does the page introduce a new color because the app needs emotional identity, or just because no token was used?
3. Are hover/focus/loading/disabled states present?
4. Does the mobile layout preserve the same hierarchy instead of merely shrinking desktop?
5. Does the animation clarify state change, or is it decorative noise?
6. Can this pattern become a small shared class or component for the next app?
