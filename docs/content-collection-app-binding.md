# Content Collection / App Binding

## 一句话

Content Collection 是“内容创作中心”和“轻应用运行时”之间的最小协议层；App Binding 决定某个应用、物体或 token 使用哪组内容。

它不是 CMS，也不是页面编辑器。

## 数据模型

### content_collections

内容集合元信息。

- `id`
- `name`
- `slug`
- `description`
- `primary_modality`
- `theme_color`
- `status`
- `metadata_json`

### content_collection_blocks

内容集合里的展示块，字段对齐前端 `ContentBlock`。

- `kind`
- `title`
- `body`
- `url`
- `poster`
- `caption`
- `tag`
- `action`
- `emphasis`
- `metadata_json`
- `sort_order`

### app_bindings

应用绑定关系。

- `app_code`
- `object_type`
- `object_id`
- `token_id`
- `token`
- `content_collection_id`
- `binding_role`
- `status`
- `starts_at`
- `ends_at`
- `metadata_json`

## 绑定优先级

运行时查询 active binding 时，优先级从高到低：

1. token 绑定。
2. token_id 绑定。
3. object 绑定。
4. app 级默认绑定。

这样一个轻应用可以先有默认内容，也可以为某个具体贴纸或摆件覆写内容。

## 当前 API

官方接口前缀：`/api/content-collections`

- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `GET /bindings`
- `POST /bindings`
- `PUT /bindings/:id`
- `DELETE /bindings/:id`

当前只提供 API，不做完整后台页面。

## 使用边界

适合：

- 一个新轻应用需要快速绑定一组图文、音频、视频、动作提示。
- 内容创作中心需要把多媒介素材组织成可复用集合。
- 某个具体 NFC token 需要使用不同内容。

暂不适合：

- 复杂页面搭建。
- 可视化拖拽编辑。
- 多人协作审核流。
- 全站内容搜索和发布系统。

## 下一步

选择一个新轻应用试用这个协议。如果它减少了重复 glue code，再考虑做轻量官方管理页；如果没有，就保持它只是后端能力。
