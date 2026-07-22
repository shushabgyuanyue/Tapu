# Mint Space 合照资源规范

本文档定义 Mint Space 首页合照、空间描述与人格标签的官方资源交付规范。它属于 Mint Space / OS 表达层资源规范，不是管理后台页面设计。

## 目标

- Mint Space 合照由官方按 IP 组合提供，不由前端临时拼贴。
- 前端只负责读取组合结果、展示合照、保存分享图与降级兜底。
- 同一组 IP 应稳定得到同一张合照、同一段空间描述和同一组人格标签，方便后续批量生产与替换。

## 组合 Key

- 使用用户已绑定 IP 定义的 `code` 生成组合 Key。
- 组合 Key 必须先去重，再按字母序排序。
- 推荐格式：`mint-space_combo__desktop-secret__tissue-puppy`。
- 单 IP 推荐格式：`mint-space_combo__tissue-puppy`。
- 空灵境保留默认 Key：`mint-space_combo__empty`。

## 图片规格

- 页面主图：推荐 `2400 x 1600`，比例 `3:2`。
- 分享图源图：推荐同一构图提供 `2160 x 2880`，比例 `3:4`；没有单独分享图时，前端会用页面主图居中裁切生成分享图。
- 格式：优先 `jpg` 或 `webp`；需要透明叠层时可提供 `png`，但不建议作为主合照格式。
- 安全区：人物、IP 和关键文字不要贴近边缘，四周至少保留 `8%` 留白。
- 文字原则：合照本身尽量不内嵌大段文字，页面会叠加轻量标题、人格标签和空间描述。

## 元数据字段

后续进入后端配置时，建议每个组合提供：

```json
{
  "comboKey": "mint-space_combo__desktop-secret__tissue-puppy",
  "ipCodes": ["desktop-secret", "tissue-puppy"],
  "collageImageUrl": "/mint-space/collages/desktop-secret__tissue-puppy.jpg",
  "shareImageUrl": "/mint-space/collages/desktop-secret__tissue-puppy-share.jpg",
  "personalityCode": "WYGI",
  "description": "一个安静、温柔，又带一点秘境感的桌面空间。",
  "personalityDescription": "它更像一个会把情绪放轻、把风景藏近的空间。"
}
```

## 降级规则

- 如果找不到精确组合图，优先使用当前 IP 数量最多的子集组合图。
- 如果仍然找不到，使用 `mint-space_combo__empty`。
- 如果官方资源不可用，前端保留固定默认合照兜底，但不能把兜底当成正式组合资产。

## 当前实现状态

- 当前页面使用固定默认合照作为兜底。
- 分享图已改为优先绘制真实合照图，而不是重新生成抽象渐变。
- 官方预览和组合资源管理暂不做后台 UI，后续可接入配置表或静态资源 manifest。
