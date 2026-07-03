# tapU · 模块与分工

---

## 整体进度快照

| 一级域 | 估计完成度 | 档位 | 备注 |
|--------|------------|------|------|
| frontend（前端域） | 85% | 进行中 | 官网+社区+播放器滑动+管理端全面升级 |
| backend（后端域） | 80% | 进行中 | Express API + 转码 + 统计 + 社交互动 |
| storage（存储域） | 40% | 待对接 | R2 服务已写，需配置环境变量实际对接 |

## 一级：当前域

| 域 | 典型分支前缀 | 职责 |
|----|----------------|------|
| frontend | evo/fe-* | Vue 3 SPA：播放页秒开+滑动切换、管理端 Dashboard、官网 Landing、社区发现页 |
| backend | evo/be-* | Express API：视频 CRUD、分组、统计、转码、社交互动（点赞/收藏/分享/设默认） |
| storage | evo/storage-* | Cloudflare R2 对象存储，CDN 分发视频资源 |

## 按域明细

### frontend（前端域）
- **核心能力**：
  - 播放页秒开（poster + critical CSS + code-split）
  - 播放页上滑切换同组视频 + 双击设为默认
  - 管理端顶部导航 + 拖拽上传 + 分组弹窗 + 转码状态轮询
  - SVG 图表 + 日期/分组筛选
  - 官网 Landing（whatmint 品牌 · 永远系列 · 价值主张）
  - 社区发现页（卡片网格 + 点赞/收藏/分享 + 二创入口）
- **当前分支**：`evo/fe-admin-upgrade`

### backend（后端域）
- **核心能力**：
  - 视频上传 → 9:16 转码 → 封面帧提取 → R2 上传（或本地）
  - 统计 API：overview/daily 支持 group_id + date range
  - 社交互动 API：like/favorite/share/default/popular
  - 同组视频 siblings API（播放器滑动 feed）
- **当前分支**：`evo/fe-admin-upgrade`

### storage（存储域）
- **核心能力**：S3 兼容 API 上传/删除，CDN 公共 URL 分发
- **状态**：代码已就绪（r2.js），需环境变量配置后激活
- **当前分支**：`evo/fe-admin-upgrade`
