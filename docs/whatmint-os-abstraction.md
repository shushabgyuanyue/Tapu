# WhatMint OS 抽象雏形

## 背景

WhatMint 不是先做一个完整平台，再让应用迁入；当前策略是先做有代表性的爆款轻应用，再把共性沉淀成平台能力。

本轮 OS 抽象只处理已经被三个轻应用共同证明的底层事实：

- 现实物体需要稳定身份。
- NFC 触碰需要统一运行时。
- 内容需要以块协议进入容器。
- 触碰和内容消费需要进入统一事件账本。

## 四个核心层

### 1. Object Identity

物体身份是 WhatMint 的最小单元。它不等于某一张表，也不等于某个应用的 token，而是对外表达为：

```js
{
  type: 'nfc-sticker',
  id: '<object-id>',
  tokenId: '<token-id>',
  token: '<token>',
  label: '<human-label>',
  status: 'active',
  displayName: '<object-name>',
  themeColor: '<theme-color>'
}
```

当前实现入口：`tapu/server/services/objectRegistry.js`

已接入：

- `answer-book`：答案之书贴纸。
- `daily-sticker`：手账慢故事贴纸。

后续再接入情绪 IP 实体和收藏作品。

### 2. Tap Runtime

触碰运行时负责把一次 NFC 访问包装成稳定协议：

```js
{
  protocol: { name: 'whatmint.tap', version: '0.1' },
  object: {},
  app: {},
  content: { title: '', subtitle: '', blocks: [] },
  actions: [],
  permissions: {}
}
```

当前实现入口：`tapu/server/services/tapRuntime.js`

轻应用仍保留自己的仪式感和交互节奏，但内容、物体、权限、动作的外壳开始统一。

### 3. Content Blocks

内容块是轻应用交给内容容器的展示协议。它不关心浏览器差异，也不直接处理视频、音频、图片兼容细节。

当前前端入口：`tapu/src/components/content/ContentRenderer.vue`

当前后端接入：

- `answer-book /resolve` 已返回 `content.blocks`，前端优先使用协议块，缺失时回退到旧的 `card` 拼装逻辑。
- `daily-sticker /resolve` 已返回 `content.blocks`，前端保留原有视觉外壳，但故事内容区交给 `ContentRenderer`。

### 4. Object Events

`object_events` 是跨应用事件账本，用于记录“一个现实物体在某个应用里发生了什么”。

当前字段关注：

- `object_type` / `object_id`
- `token_id` / `token`
- `app_code`
- `event_type`
- `content_id`
- `user_id`
- `user_agent`
- `metadata_json`

当前接入：

- 答案之书抽卡会继续写入 `answer_book_draw_events`，同时写入 `object_events`。
- 手账慢故事贴纸触碰会继续写入 `daily_sticker_tap_events`，同时写入 `object_events`。

## 当前不做

- 不做统一前端 `/tap/:token` 总路由。
- 不迁移所有旧应用数据。
- 不把内容创作中心改造成完整 CMS。
- 不提前定义复杂权限矩阵。
- 不为了平台感牺牲轻应用的克制体验。

## 下一步建议

1. 把情绪 IP 实体的触碰播放事件也映射到 `object_events`。
2. 为内容创作中心定义“内容集合”和“应用绑定”的最小协议。
3. 观察两个贴纸应用的协议差异，再决定是否需要统一 `/tap/:token` 总路由。
4. 在内容容器中继续攻坚 iOS Safari、微信内置浏览器和 Android WebView 的媒体兼容。

## 判断标准

一次 OS 抽象只有在它减少后续轻应用重复劳动时才成立。

WhatMint 的平台能力应该像水印一样存在：用户看到的是贴纸、摆件、纸巾小狗和一本会回应的书；复杂的路由、权限、内容协议和事件账本留在后端安静工作。
