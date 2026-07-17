# WhatMint Object Events 命名规范

## 目标

`object_events` 记录的是“现实物体在某个轻应用里发生了什么”。它不是替代所有业务表，而是让不同应用拥有统一观察层。

事件命名要稳定、少而清楚，优先服务三个问题：

- 这个物体有没有被触碰？
- 这个内容有没有被消费？
- 这个轻应用有没有产生情绪或商业信号？

## 命名原则

- 使用小写 snake_case。
- 事件名描述用户行为或系统结果，不描述数据库实现。
- 应用特有事件可以保留，但要能映射到通用事件族。
- 先少后多，不为了分析想象提前制造几十种事件。

## 通用事件族

| event_type | 含义 | 适用场景 |
| --- | --- | --- |
| `tap_open` | NFC/链接触碰打开 | 所有轻应用的入口事件 |
| `content_view` | 内容被展示 | 图文、视频、音频、网页、卡片 |
| `media_play` | 媒体开始播放 | 视频、音频 |
| `media_complete` | 媒体播放完成 | 视频、音频 |
| `action_click` | 用户点击轻动作 | 再问一次、复制、分享、跳转 |
| `share_click` | 用户触发分享 | 传播判断 |
| `bind_object` | 用户绑定物体 | 所有权/资产关系 |
| `unbind_object` | 用户解绑物体 | 所有权/售后关系 |

## 当前应用事件

| app_code | 当前事件 | 可映射通用事件 | 说明 |
| --- | --- | --- | --- |
| `answer-book` | `answer_draw` | `tap_open` + `content_view` | 一次触碰会抽取一张答案卡 |
| `earphone-girl` | `earphone_girl_touch` | `tap_open` + `content_view` | 一次触碰会展示当前故事空间内容 |
| `moment` | `moment_tap` | `tap_open` + `content_view` | 一次触碰会打开某个纪念瞬间 |
| `travel-trail` | `travel_trail_tap` | `tap_open` + `content_view` | 一次触碰会展开旅行轨迹 |
| `travel-trail` | `travel_next_destination_set` | `action_click` | 用户写下下一站 |
| `travel-trail` | `travel_return_confirmed` | `action_click` | 用户回来后把下一站加入轨迹 |
| `check` | `check_tap` | `tap_open` + `content_view` | 一次触碰会打开某个物件的检查清单 |
| `check` | `check_item_toggled` | `action_click` | 用户勾选或取消某个检查项 |
| `check` | `check_item_added` | `action_click` | 用户给具体物件新增自定义检查项 |
| `check` | `check_reset` | `action_click` | 用户重新开始一次检查 |

## metadata 建议

`metadata_json` 用来放低频、应用相关上下文，不要把核心查询字段塞进去。

推荐字段：

- `deckId`
- `personaId`
- `worldId`
- `storyArcId`
- `currentDay`
- `requestedDate`
- `source`
- `actionCode`
- `mediaKind`
- `checkedCount`
- `itemCount`
- `scenario`

## 暂不做

- 不把 `object_events` 做成完整埋点平台。
- 不为每一个 UI hover、scroll、曝光写事件。
- 不在事件名里塞业务对象 id。
- 不删除旧业务事件表；旧表负责业务细节，`object_events` 负责跨应用观察。
