# WhatMint OS 抽象雏形

## 背景

WhatMint 不是先做一个开放平台，再让应用迁入；当前策略是先做有代表性的自营轻应用，再把共性沉淀成 OS 能力。

本轮 OS 抽象只处理已经被新核心样本证明的底层事实：

- 现实物体需要稳定身份。
- NFC 触碰需要统一运行时。
- 内容需要以块协议进入容器。
- 内容定义和资源绑定需要能支撑不同轻应用。
- 触碰和内容消费需要进入统一事件账本。

## 五个核心层

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

- `tissue-puppy`：纸巾小狗实体入口。
- `desktop-secret`：桌面秘境 AR 贴纸。

后续再接入新的自营轻应用时，必须按新核心范式重新实现，不从已删除旧应用恢复代码路径。

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

- `/play?key=<token>` 已按内容定义选择 `video.fullscreen`、`ar.camera-overlay` 或内容块渲染，纸巾小狗和桌面秘境都走同一套 OS 内容协议。

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

- 纸巾小狗和桌面秘境触碰会写入统一操作 / 事件链路，并可继续被提炼为有意义状态。

事件命名规范见：[object-event-taxonomy.md](object-event-taxonomy.md)

### 5. Content Definition / Resource Binding

内容定义和资源绑定是内容创作中心与轻应用之间的最小稳定边界。

当前不再保留独立 `content_collections`、`app_bindings`、`works` 这一套官方 CMS 表。它们会让官方后台出现第二套“内容集合/作品”真相，和 `content_instances + resources + content_definitions` 重叠。

当前实现：

- `content_definitions`：声明应用需要的内容形态、资源 slot 和渲染模板。
- `content_instances`：官方创作和用户创作统一进入内容实例。
- `resources`：上传、转码、压缩和预览资源。
- `content_instance_resource_links`：把资源按内容定义 slot 绑定到内容实例。
- `ip_instance_content_instance_links`：把内容实例绑定到实体 IP，承担 owner default / official default。
- Mint Studio：统一承载官方内容和用户内容的创建、修改、资源替换流程。

## 当前不做

- 不做统一前端 `/tap/:token` 总路由。
- 不迁移所有旧应用数据。
- 不把内容创作中心改造成完整 CMS。
- 不保留第二套官方 CMS/作品中心；新应用优先按核心对象、内容定义、资源协议和适配器范式接入。
- 不提前定义复杂权限矩阵。
- 不为了开放平台感牺牲自营轻应用的克制体验。

## 下一步建议

1. 把更多新核心 IP 的触碰播放事件映射到统一操作和事件链路。
2. 用纸巾小狗和桌面秘境继续验证 `Content Definition / Resource / Renderer` 是否真的减少重复劳动。
3. 观察多个核心 IP 应用的协议差异，再决定是否需要统一 `/tap/:token` 总路由。
4. 在内容容器中继续攻坚 iOS Safari、微信内置浏览器和 Android WebView 的媒体兼容。

## 判断标准

一次 OS 抽象只有在它减少后续轻应用重复劳动时才成立。

WhatMint 的 OS 能力应该像水印一样存在：用户看到的是贴纸、摆件、纸巾小狗和桌面秘境；复杂的路由、权限、内容协议和事件账本留在后端安静工作。
