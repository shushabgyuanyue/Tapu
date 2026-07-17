# 耳机小姐核心表定义

这份文档把“耳机小姐”作为 WhatMint 第一份完整 IP 范式，直接映射到当前核心表结构：

- `ip_definitions`
- `application_definitions`
- `content_definitions`
- `resources`
- 各类连接表

目标不是先做实现细节，而是先把“耳机小姐”在核心架构里的静态定义定清楚，让后续种子数据、后台配置、创作中心录入、商城展示和应用接入都使用同一份产品真相。

## 1. 对象定位

耳机小姐不是导购，不是信息播报员，也不是万能入口。

她在 WhatMint 世界中的位置是：

- 对自己：冒险家
- 对其他 IP：倾听者
- 对用户：朋友

她的产品职责是：

- 作为高频、轻量的故事空间
- 作为用户进入 WhatMint IP 世界的柔性入口
- 作为关系叙事和 IP 联动的第一范式
- 作为“按实例持续推进”的陪伴型对象，而不是每次都从头刷新的内容入口

一句话定义：

> 耳机小姐住在你的耳机里，喜欢旅行和收集故事。她会把世界各处遇见的小事轻轻讲给你听，也带你认识那些住在你身边的朋友。

## 2. `ip_definitions` 定义草案

建议主记录：

| 字段 | 建议值 | 中文含义 / 设计意图 |
|---|---|---|
| `id` | `ipdef_earphone_girl` | 耳机小姐 IP 定义主键。 |
| `code` | `earphone-girl` | 稳定机器码，用于路由、配置和关联。 |
| `name` | `耳机小姐` | 对外展示名。 |
| `creator_user_id` | `user_official_system` | 官方创作者账号；实际录入时换成正式官方用户 id。 |
| `primary_series_key` | `whatmint-core-friends` | 所属核心系列键。 |
| `primary_series_name` | `WhatMint 核心朋友` | 所属系列中文名。 |
| `description` | `一位喜欢旅行、倾听和讲故事的耳机伙伴，把你带进 WhatMint 的朋友世界。` | 商城列表、详情摘要、后台概览使用。 |
| `story` | `耳机小姐住在你的耳机里。她喜欢去不同空间旅行，听见每个 IP 没有说完的话，再把那些温柔的小故事带回来讲给你听。她不是导游，而是会遇见、会惦记、也会偏心一点点的朋友。` | 世界观主叙事。 |
| `personality` | `冒险家；倾听者；朋友；温柔克制；有灵气；不卖弄聪明；歌颂美好但不过甜。` | 人格边界，后续内容创作、话术、视觉和语音都应受它约束。 |
| `designer` | `WhatMint Official` | 设计归属。 |
| `material` | `NFC 贴纸 / 耳机贴纸` | 实体媒介，不是应用媒介。 |
| `size_label` | `轻量贴纸` | 实体规格标签。 |
| `rarity_label` | `官方核心 IP` | 资产定位。 |
| `nfc_type` | `sticker_nfc` | 物理识别类型。 |
| `price` | `0` | 定义层先不冻结售价，商品售卖价格由正式发售配置覆盖。 |
| `currency_code` | `CNY` | 币种。 |
| `stock_limit` | `0` | `0` 表示未在定义层限制库存，后续按发售批次配置。 |
| `crowdfund_goal` | `0` | 当前不走众筹时置 `0`。 |
| `crowdfund_deadline` | `NULL` | 无众筹截止时间。 |
| `sale_mode` | `direct` | 默认直售。 |
| `cover_url` | `/ip/earphone-girl/cover.png` | 商城封面。 |
| `hero_url` | `/ip/earphone-girl/hero.png` | 详情页主视觉。 |
| `product_image_url` | `/ip/earphone-girl/product.png` | 实物展示图。 |
| `external_purchase_url` | `NULL` | 站内售卖时为空。 |
| `display_tags_json` | `["官方核心IP","故事空间","声音陪伴","关系联动"]` | 商城标签。 |
| `theme_color` | `#D98FB7` | 主题色建议，偏茉莉雨声系。 |
| `physical_spec_json` | 见下方 | 实体规格补充。 |
| `extra_json` | 见下方 | 产品补充信息、展示语义、调性约束。 |
| `status` | `active` | 当前为上架中的官方定义。 |

建议 `physical_spec_json`：

```json
{
  "coreObject": "耳机贴纸",
  "physicalCarrier": "NFC sticker",
  "primaryMedia": ["audio", "illustration"],
  "coreActions": ["listen", "tell_story", "share"],
  "usageFrequency": "high",
  "interactionWeight": "light"
}
```

建议 `extra_json`：

```json
{
  "ipType": "official_core_ip",
  "appPosition": "story_space_and_ip_gateway",
  "emotionalValue": [
    "呈现这个奇妙的IP世界",
    "讲故事",
    "发现",
    "连接"
  ],
  "userRelationship": [
    "带你进入IP世界",
    "讲述者",
    "朋友介绍人"
  ],
  "toneKeywords": [
    "有灵气",
    "成熟克制",
    "歌颂美好",
    "兼具商业性"
  ],
  "shopNarrativeFocus": [
    "声音陪伴",
    "手账感视觉",
    "跨IP关系入口"
  ]
}
```

## 3. `application_definitions` 定义草案

建议主记录：

| 字段 | 建议值 | 中文含义 / 设计意图 |
|---|---|---|
| `id` | `appdef_earphone_girl_story_space` | 耳机小姐应用定义主键。 |
| `code` | `earphone-girl-story-space` | 应用稳定编码。 |
| `name` | `耳机小姐 · 故事空间` | 对外展示名称。 |
| `version_no` | `1.0.0` | 当前应用定义版本。 |
| `app_type` | `meaning` | 她回答的是“今天我会遇见什么故事与朋友”，更偏意义型入口。 |
| `interaction_type` | `audio_story_gateway` | 交互类型：声音故事 + IP 入口。 |
| `description` | `一个以声音和插画承载的轻故事空间，负责讲述、连接和引导进入其他 IP 世界。` | 官方后台、配置说明和应用列表摘要。 |
| `object_principle` | `一枚耳机贴纸不只打开内容，而是打开一个会旅行、会倾听、会带回故事的朋友。` | 物件原则。 |
| `behavior` | `touch_to_listen_then_follow_story` | 触碰后进入听故事与继续探索的行为。 |
| `meaning_question` | `今天我会从她这里听见谁的故事？` | 该应用回答的生活问题。 |
| `experience_flow_json` | 见下方 | 体验流定义。 |
| `skill_config_json` | 见下方 | 固定化 skill 声明，不引入 AI。 |
| `content_template_json` | 见下方 | 应用支持的内容模板集合。 |
| `event_subscription_json` | 见下方 | 事件订阅与触发规则。 |
| `key_action_schema_json` | 见下方 | 应用上报的重要操作定义。 |
| `route_config_json` | 见下方 | 运行入口、创作入口和详情入口。 |
| `permission_policy_json` | 见下方 | 官方和普通用户的操作边界。 |
| `extra_json` | 见下方 | 调性、节奏、创作约束和运行时配置。 |
| `status` | `active` | 启用中。 |

建议 `experience_flow_json`：

```json
{
  "entry": {
    "gesture": "touch",
    "route": "/sticker",
    "shell": "story_space"
  },
  "flow": [
    {
      "step": "enter_sound_room",
      "label": "进入声音空间"
    },
    {
      "step": "resolve_latest_story",
      "label": "查找当前周期最新故事"
    },
    {
      "step": "play_story_bundle",
      "label": "播放一张插画加一段语音"
    },
    {
      "step": "check_repeat_touch_in_cycle",
      "label": "检查当前周期是否二次触碰"
    },
    {
      "step": "show_crossover_invite",
      "label": "展示跨IP插画、音乐和入口"
    },
    {
      "step": "open_related_ip_example",
      "label": "新开页面进入关联IP官方示例"
    }
  ],
  "cadence": {
    "mode": "instance_sequence_with_window",
    "defaultHours": 12,
    "configurable": true
  },
  "memoryPanel": {
    "enabled": true,
    "label": "发生过的故事"
  },
  "progression": {
    "scope": "ip_instance",
    "policy": "consume_next_in_order",
    "advanceOn": "story_play_completed",
    "fallbackWhenExhausted": "loop_from_start_or_wait_for_new_content",
    "crossoverIsSecondaryTrack": true
  }
}
```

建议 `skill_config_json`：

```json
{
  "engineMode": "fixed_rules_v1",
  "skills": [
    {
      "key": "scheduled_story_broadcast",
      "label": "定时故事播报",
      "trigger": {
        "type": "time_window_refresh"
      },
      "actions": [
        "resolve_next_story_in_instance_queue",
        "assemble_story_bundle"
      ]
    },
    {
      "key": "repeat_touch_crossover_invite",
      "label": "二次触碰联动邀请",
      "trigger": {
        "type": "repeat_touch_same_window"
      },
      "actions": [
        "resolve_related_official_story",
        "assemble_crossover_bundle",
        "expose_gateway_cta"
      ]
    },
    {
      "key": "event_story_cameo",
      "label": "事件联动讲述",
      "trigger": {
        "events": [
          "emotion.frequent_touch",
          "relationship.official_highlight"
        ]
      },
      "actions": [
        "create_story_content_instance",
        "record_event_consumption"
      ]
    }
  ]
}
```

建议 `content_template_json`：

```json
{
  "primaryTemplates": [
    "earphone-girl-periodic-story",
    "earphone-girl-crossover-invite",
    "earphone-girl-memory-story"
  ],
  "storyQueue": {
    "orderingMode": "manual_sort_order",
    "scope": "official_content_per_ip_instance",
    "progressStateKey": "story.sequence_progress"
  },
  "defaultBindingPolicy": {
    "officialContentRequiresManualDefaultSelection": true,
    "autoBindOnCreation": false
  }
}
```

建议 `event_subscription_json`：

```json
{
  "subscriptions": [
    {
      "eventType": "emotion.frequent_touch",
      "scope": "related_ip_only",
      "role": "listener"
    },
    {
      "eventType": "relationship.official_highlight",
      "scope": "official_relation_matrix",
      "role": "storyteller"
    }
  ],
  "triggerRules": [
    {
      "skillKey": "event_story_cameo",
      "cooldownHours": 12,
      "maxConsumptionsPerEvent": 1
    }
  ]
}
```

建议 `key_action_schema_json`：

```json
{
  "operations": [
    {
      "key": "object.touch",
      "label": "触碰耳机小姐",
      "recordAs": "operation"
    },
    {
      "key": "story.play",
      "label": "播放故事",
      "recordAs": "operation"
    },
    {
      "key": "story.play_completed",
      "label": "故事播放完成",
      "recordAs": "operation"
    },
    {
      "key": "gateway.open_ip",
      "label": "从耳机小姐进入其他IP",
      "recordAs": "operation"
    },
    {
      "key": "memory.view",
      "label": "查看发生过的故事",
      "recordAs": "operation"
    }
  ]
}
```

说明：

- `story.play` 表示开始播放，不应推进队列。
- `story.play_completed` 才表示这条故事已被该实例真正消费，允许推进到下一条。
- 联动内容是副轨，不应覆盖主故事队列的顺序状态。

建议 `route_config_json`：

```json
{
  "openRoute": "/sticker",
  "shopDetailRoute": "/community/ip/:id",
  "studioRoute": "/mint-studio",
  "adminRoute": "/official/applications",
  "relatedIpOpenMode": "new_page",
  "runtimeAdapter": "earphone-girl"
}
```

建议 `permission_policy_json`：

```json
{
  "read": "public",
  "createContent": "login_required",
  "bindByToken": "token_unbound_or_owner",
  "setOfficialDefaultContent": "admin_required",
  "manageApplicationDefinition": "admin_required"
}
```

建议 `extra_json`：

```json
{
  "voiceDirection": [
    "有灵气",
    "有个性",
    "成熟克制",
    "不做导购",
    "像遇见朋友而不是接收播报"
  ],
  "visualDirection": [
    "手账感",
    "生活插画",
    "留白",
    "声音可视化"
  ],
  "audioDirection": [
    "轻叙述",
    "呼吸感",
    "不戏剧化"
  ],
  "businessConstraint": {
    "noMallRedirectForV1": true,
    "ctaTarget": "related_ip_official_example"
  }
}
```

## 4. `content_definitions` 定义草案

耳机小姐建议先固定三种内容定义，已经足够支撑首版体验。

### 4.1 周期故事内容

对应一条插画 + 一条语音的主故事单元。

| 字段 | 建议值 | 中文含义 / 设计意图 |
|---|---|---|
| `id` | `cntdef_earphone_girl_periodic_story` | 周期故事模板主键。 |
| `code` | `earphone-girl-periodic-story` | 模板编码。 |
| `name` | `耳机小姐周期故事` | 创作中心选择名。 |
| `description` | `耳机小姐按配置周期讲述的一则主故事，承载插画、文案和语音。` | 模板说明。 |
| `content_kind` | `mixed` | 混合型内容。 |
| `primary_modality` | `mixed` | 主模式为图文音混合。 |
| `authoring_schema_json` | 见下方 | 创作字段定义。 |
| `template_json` | 见下方 | 渲染模板定义。 |
| `extra_json` | 见下方 | 节奏、调性与官方范式约束。 |
| `status` | `active` | 启用中。 |

建议 `authoring_schema_json`：

```json
{
  "fields": [
    { "key": "title", "type": "string", "required": true },
    { "key": "lead", "type": "text", "required": true },
    { "key": "body", "type": "markdown", "required": true },
    { "key": "mood", "type": "string", "required": true },
    { "key": "voiceoverText", "type": "text", "required": true },
    { "key": "cadenceHours", "type": "number", "required": false },
    { "key": "relatedIpDefinitionIds", "type": "string[]", "required": false },
    { "key": "ctaLabel", "type": "string", "required": false },
    { "key": "ctaTargetIpDefinitionId", "type": "string", "required": false },
    { "key": "ctaTargetType", "type": "string", "required": false }
  ],
  "resourceRequirements": [
    { "role": "story_visual", "type": "image", "required": true, "maxCount": 1 },
    { "role": "story_voice", "type": "audio", "required": true, "maxCount": 1 },
    { "role": "story_bgm", "type": "audio", "required": false, "maxCount": 1 }
  ]
}
```

建议 `template_json`：

```json
{
  "renderer": "story_audio_card_v1",
  "layout": "single_visual_with_caption",
  "showProgressHint": false,
  "showMemorySaveHint": true
}
```

建议 `extra_json`：

```json
{
  "toneRule": "像她真的遇见了一件事，再回来轻轻讲给朋友听",
  "forbiddenPatterns": [
    "导购口吻",
    "信息播报口吻",
    "过度煽情",
    "强行鸡汤"
  ]
}
```

### 4.2 联动邀请内容

对应二次触碰时的联动画面、音乐和入口。

| 字段 | 建议值 | 中文含义 / 设计意图 |
|---|---|---|
| `id` | `cntdef_earphone_girl_crossover_invite` | 联动邀请模板主键。 |
| `code` | `earphone-girl-crossover-invite` | 模板编码。 |
| `name` | `耳机小姐联动邀请` | 创作中心选择名。 |
| `description` | `耳机小姐与其他IP的联动预览内容，用于二次触碰和关系展示。` | 模板说明。 |
| `content_kind` | `mixed` | 图文音混合。 |
| `primary_modality` | `mixed` | 主模式为视觉加音乐。 |
| `authoring_schema_json` | 见下方 | 创作字段定义。 |
| `template_json` | 见下方 | 渲染模板定义。 |
| `extra_json` | 见下方 | 入口和关系表达约束。 |
| `status` | `active` | 启用中。 |

建议 `authoring_schema_json`：

```json
{
  "fields": [
    { "key": "title", "type": "string", "required": true },
    { "key": "sceneText", "type": "text", "required": true },
    { "key": "relationLabel", "type": "string", "required": true },
    { "key": "linkedIpDefinitionId", "type": "string", "required": true },
    { "key": "entryLabel", "type": "string", "required": true },
    { "key": "entryTargetIpDefinitionId", "type": "string", "required": true },
    { "key": "entryTargetType", "type": "string", "required": true }
  ],
  "resourceRequirements": [
    { "role": "crossover_visual", "type": "image", "required": true, "maxCount": 1 },
    { "role": "crossover_music", "type": "audio", "required": false, "maxCount": 1 }
  ]
}
```

建议 `template_json`：

```json
{
  "renderer": "crossover_gateway_card_v1",
  "layout": "illustration_with_entry_button",
  "buttonStyle": "soft_entry"
}
```

建议 `extra_json`：

```json
{
  "entryTarget": "official_example_only",
  "toneRule": "分享遇见，不做推销"
}
```

### 4.3 记忆故事内容

对应“发生过的故事”面板中的故事记录。

| 字段 | 建议值 | 中文含义 / 设计意图 |
|---|---|---|
| `id` | `cntdef_earphone_girl_memory_story` | 记忆故事模板主键。 |
| `code` | `earphone-girl-memory-story` | 模板编码。 |
| `name` | `耳机小姐记忆故事` | 创作中心选择名。 |
| `description` | `耳机小姐保存已经发生过的故事，不是日记，而是值得回来看的记忆片段。` | 模板说明。 |
| `content_kind` | `mixed` | 混合内容。 |
| `primary_modality` | `mixed` | 主模式为图文。 |
| `authoring_schema_json` | 见下方 | 创作字段定义。 |
| `template_json` | 见下方 | 渲染模板定义。 |
| `extra_json` | 见下方 | 归档和展示语义。 |
| `status` | `active` | 启用中。 |

建议 `authoring_schema_json`：

```json
{
  "fields": [
    { "key": "title", "type": "string", "required": true },
    { "key": "summary", "type": "text", "required": true },
    { "key": "storyMoment", "type": "markdown", "required": true },
    { "key": "sourceEventType", "type": "string", "required": false },
    { "key": "relatedIpDefinitionIds", "type": "string[]", "required": false }
  ],
  "resourceRequirements": [
    { "role": "memory_visual", "type": "image", "required": false, "maxCount": 1 },
    { "role": "memory_voice", "type": "audio", "required": false, "maxCount": 1 }
  ]
}
```

建议 `template_json`：

```json
{
  "renderer": "memory_story_note_v1",
  "layout": "scrapbook_note"
}
```

建议 `extra_json`：

```json
{
  "semantic": "发生过的故事",
  "notSemantic": "连续日记"
}
```

## 5. `resources` 角色约定

`resources` 表本身只保存资源事实，不保存业务语义。耳机小姐的业务语义应通过 `content_instance_resource_links.relation_role` 表达。

建议资源角色如下：

| `relation_role` | 资源类型 | 用途 |
|---|---|---|
| `cover_image` | `image` | IP 封面。 |
| `hero_image` | `image` | IP 详情主视觉。 |
| `product_image` | `image` | 实物商品展示。 |
| `story_visual` | `image` | 周期故事插画。 |
| `story_voice` | `audio` | 周期故事主语音。 |
| `story_bgm` | `audio` | 周期故事可选氛围音乐。 |
| `crossover_visual` | `image` | 联动邀请插画。 |
| `crossover_music` | `audio` | 联动邀请音乐。 |
| `memory_visual` | `image` | 记忆故事插画。 |
| `memory_voice` | `audio` | 记忆故事补充语音。 |

推荐资源规范：

- 封面与主视觉资源可由商城和详情页共用，但仍应各自保留角色语义。
- 周期故事至少保证一张插画和一段语音，避免耳机小姐退化成纯文案播报。
- 联动邀请不强制语音，但至少要有联动画面；否则“遇见感”不成立。

## 6. 连接表定义

### 6.1 `ip_definition_application_links`

| 字段 | 建议值 | 含义 |
|---|---|---|
| `id` | `ipalink_earphone_girl_primary` | 主连接 id。 |
| `ip_definition_id` | `ipdef_earphone_girl` | 耳机小姐 IP。 |
| `application_definition_id` | `appdef_earphone_girl_story_space` | 对应应用。 |
| `relation_role` | `primary` | 主应用。 |
| `is_primary` | `1` | 当前业务上就是一对一主映射。 |
| `sort_order` | `0` | 默认第一。 |
| `metadata_json` | `{"shopEntry":true,"storyEntry":true}` | 商城和故事入口都走该应用。 |

### 6.2 `application_content_definition_links`

| `application_definition_id` | `content_definition_id` | `relation_role` | `is_primary` | 含义 |
|---|---|---|---|---|
| `appdef_earphone_girl_story_space` | `cntdef_earphone_girl_periodic_story` | `default_story` | `1` | 主故事模板。 |
| `appdef_earphone_girl_story_space` | `cntdef_earphone_girl_crossover_invite` | `crossover_preview` | `0` | 二次触碰联动模板。 |
| `appdef_earphone_girl_story_space` | `cntdef_earphone_girl_memory_story` | `memory_archive` | `0` | 记忆归档模板。 |

补充：

- 主故事模板对应的官方 `content_instances` 需要可排序。
- 排序不建议写死在模板里，而应落在内容实例绑定关系或内容集合顺序上。
- 耳机小姐首版可以先按官方内容的 `sort_order` 形成固定队列。

### 6.3 `ip_definition_relation_links`

耳机小姐是关系叙事入口，这张表对她尤其关键。

建议先固化官方关系矩阵示例：

| `source_ip_definition_id` | `target_ip_definition_id` | `relation_type` | `relation_label` | `reverse_relation_type` | `reverse_relation_label` | 含义 |
|---|---|---|---|---|---|---|
| `ipdef_earphone_girl` | `ipdef_tissue_puppy` | `good_friend` | `会互相惦记的好朋友` | `good_friend` | `会互相惦记的好朋友` | 纸巾小狗和耳机小姐互相温柔回应。 |
| `ipdef_earphone_girl` | `ipdef_answer_book` | `listens_to` | `会去请教的老师` | `guides` | `偶尔点醒她的老师` | 答案之书更像她愿意聆听的老师。 |
| `ipdef_earphone_girl` | `ipdef_travel_checklist` | `admires` | `欣赏它总能把出发前的世界整理清楚` | `is_admired_by` | `被她悄悄欣赏着` | 用成熟克制的关系表达代替直白推销。 |

说明：

- 这张表保存的是官方设定关系，而不是用户运行时随机情绪分析。
- 后续如果加入运行时关系波动，也应沉淀到 supporting/runtime 层，不覆盖官方关系矩阵。

## 7. 内容实例承载建议

虽然这份文档定义的是 Definition 层，但耳机小姐的范式很依赖 `content_instances.payload_json` 的稳定结构，建议提前约定。

### 7.1 周期故事实例示例

```json
{
  "queueKey": "official-main-sequence",
  "sequenceOrder": 2,
  "title": "她今天从草原回来",
  "lead": "耳机小姐今天去看了纸巾小狗。",
  "body": "她说草原上的风很轻，纸巾小狗把一整天的温柔都叠在口袋里，像怕谁突然需要一张纸。",
  "mood": "柔软",
  "voiceoverText": "我今天去看纸巾小狗了，它还是一样，很安静，也很会照顾别人的心情。",
  "cadenceHours": 12,
  "relatedIpDefinitionIds": ["ipdef_tissue_puppy"],
  "cta": {
    "label": "去看看纸巾小狗",
    "targetIpDefinitionId": "ipdef_tissue_puppy",
    "targetType": "official_ip_example"
  }
}
```

### 7.2 联动邀请实例示例

```json
{
  "title": "她刚从纸巾小狗那里回来",
  "sceneText": "风把草叶吹得有点歪，耳机小姐坐在旁边听它讲今天收到了多少温柔。",
  "relationLabel": "好朋友",
  "linkedIpDefinitionId": "ipdef_tissue_puppy",
  "entryLabel": "进入纸巾小狗空间",
  "entryTargetIpDefinitionId": "ipdef_tissue_puppy",
  "entryTargetType": "official_ip_example"
}
```

### 7.3 记忆故事实例示例

```json
{
  "title": "那天她说世界被调低了一格",
  "summary": "一次关于雨声、茉莉和通勤的故事。",
  "storyMoment": "她没有播放音乐，只把世界调低了一格。",
  "sourceEventType": "emotion.frequent_touch",
  "relatedIpDefinitionIds": ["ipdef_earphone_girl"]
}
```

## 8. 实例级队列推进规则

耳机小姐首版不应该采用“今天所有人都看同一天内容”的日历推进方式。

她更合理的规则是：

> 每一个耳机小姐 `ip_instance` 都有自己的主故事消费队列。

例如：

- 实例 A 上次完整看完了内容 1
- 即使 3 天后再碰
- 只要没有进入联动副轨抢占
- 下次主呈现也应该是内容 2，而不是重新给内容 1

推荐落法：

- 不新增核心表。
- 用 OS supporting state 记录实例级进度。
- 进度主体是 `ip_instance`，不是用户，也不是全局应用。

建议状态语义：

```json
{
  "state_key": "story.sequence_progress",
  "subject_type": "object",
  "subject_id": "ipinst_xxx",
  "evidence": {
    "queueKey": "official-main-sequence",
    "lastConsumedContentInstanceId": "cntinst_story_001",
    "lastConsumedOrder": 1,
    "nextContentInstanceId": "cntinst_story_002",
    "nextOrder": 2,
    "advancedAt": "2026-07-16T12:00:00Z"
  }
}
```

这里推荐使用现有 `meaningful_states`：

- `subject_type = object`
- `subject_id = ip_instance_id`
- `state_key = story.sequence_progress`
- `evidence_json` 保存当前队列游标

原因：

- 这不是核心业务对象，而是运行时状态。
- 它比把进度硬塞进 `ip_instances.metadata_json` 更清晰。
- 它比为了耳机小姐单独建一张 story progress 表更符合当前 OS 范式。

推进时机建议：

1. 用户触碰耳机小姐。
2. 应用解析该实例当前 `story.sequence_progress`。
3. 返回下一条应该呈现的主故事。
4. 故事完整播放或用户明确看完后，上报 `story.play_completed`。
5. OS 更新该实例的 `story.sequence_progress` 到下一条。

注意区分两条轨道：

- 主故事队列：按实例顺序推进，长期记忆。
- 联动副轨内容：按周期或事件插入，不改变主故事队列本身。

这意味着：

- 超过联动周期后，不是回到旧故事，而是继续主队列的下一条。
- 联动内容只是在某次触碰中暂时抢占展示，不应抹掉实例自己的长期故事记忆。

## 9. 首版范式结论

如果按这份定义落表，耳机小姐已经足够成为 WhatMint 第一份完整 IP 范式：

- `ip_definitions` 定义她是谁、长什么样、以什么物存在
- `application_definitions` 定义她如何活着、如何讲述、如何连接其他 IP
- `content_definitions` 定义她允许创造哪些内容单元
- `resources` 与连接表定义她最终靠哪些视觉和声音资产运行
- `ip_definition_relation_links` 定义她和世界中其他 IP 的官方关系矩阵

这意味着后续做耳机小姐，不需要再发明第二套结构。

只需要继续沿着这份定义去做三件事：

1. 在创作中心按这三类 `content_definitions` 创作官方内容。
2. 在商城和详情页按 `ip_definitions + relation_links + 官方默认内容` 展示。
3. 在运行时按 `application_definitions` 的节奏、skill 和入口规则组装体验。
