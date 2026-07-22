# WhatMint 内容容器架构

## 目标

WhatMint 的轻应用会持续出现多种内容形态：视频、音频、图片、文字、网页、卡片、动作提示和未来的复合页面。

内容容器的目标不是一次性解决所有浏览器兼容问题，而是先把架构边界放对：

- 轻应用只描述内容块，不直接处理浏览器细节。
- 媒体兼容能力集中在独立 renderer 中逐个攻坚。
- 同一类内容在不同应用里保持一致的降级和基础审美。
- 后续新增媒体类型时，不需要重构每个轻应用页面。

## 当前实现

前端内容容器位于：

`tapu/src/components/content/`

当前包含：

- `types.ts`：内容块协议和渲染上下文。
- `capabilities.ts`：浏览器媒体能力检测。
- `ContentRenderer.vue`：统一内容块入口。
- `ContentTextBlock.vue`：标题、正文、引用、卡片文本。
- `ContentImageBlock.vue`：图片内容。
- `ContentVideoBlock.vue`：视频内容和基础降级。
- `ContentAudioBlock.vue`：音频内容。
- `ContentActionBlock.vue`：正念动作、任务、提示。
- `ContentLinkBlock.vue`：外链内容。

## 内容块协议

每个轻应用可以把业务数据转换成 `ContentBlock[]`：

```ts
type ContentBlock = {
  id?: string;
  kind: 'text' | 'heading' | 'image' | 'video' | 'audio' | 'quote' | 'action' | 'link' | 'card';
  title?: string;
  body?: string;
  url?: string;
  alt?: string;
  poster?: string;
  caption?: string;
  tag?: string;
  action?: string;
  emphasis?: 'normal' | 'strong' | 'quiet';
  metadata?: Record<string, unknown>;
};
```

渲染上下文由页面提供：

```ts
type ContentRenderContext = {
  surface?: 'tap' | 'detail' | 'admin' | 'embed';
  themeColor?: string;
  objectName?: string;
  appCode?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
};
```

## 已接入方向

当前新核心内容渲染以 `/play` 和内容定义协议为主入口，纸巾小狗与桌面秘境会按 `content_definitions.template.renderer` 选择 `video.fullscreen`、`ar.camera-overlay` 或基础内容块渲染。

已删除旧应用页面不再作为内容容器样本。后续若恢复即时回应型、纪念型或清单型应用，应声明为内容定义和内容块，而不是恢复旧应用私有页面和私有业务表。

## 后续迁移顺序建议

1. 桌面秘境：继续把 AR 图片、marker、阴影和渲染参数收敛到 `ar.camera-overlay` 内容协议。
2. 内容详情页：把视频详情页接入 `video` block。
3. NFC 播放器：保留专用沉浸播放器，但把视频兼容策略逐步抽到 video renderer 或共享 media helper。
4. 传信类应用：用内容块验证文字、图片、音频和私密状态。

## 兼容攻坚原则

未来遇到浏览器问题时，优先在 renderer 层修：

- iOS Safari 视频内联播放。
- 微信内置浏览器自动播放策略。
- Android WebView 音频解锁。
- 不同视频格式降级。
- 图片懒加载和解码策略。
- iframe / 外链安全沙箱。
- 大文件加载和低网速兜底。

不要把这些细节散落到每个轻应用页面里。

## 不做的事

当前不做完整 CMS、不做低代码页面编辑器、不做复杂模板市场。

内容容器现在只是一个稳定的边界：

轻应用负责表达“这个物想展示什么”。  
内容容器负责决定“这个内容如何在浏览器里可靠地出现”。
