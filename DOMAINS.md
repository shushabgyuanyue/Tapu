# tapU · 模块与分工

---

## 整体进度快照

| 一级域 | 估计完成度 | 档位 | 备注 |
|--------|------------|------|------|
| frontend（前端域） | 95% | 待联调 | 官网+社区+播放器动效升级+账号鉴权体系联调 |
| backend（后端域） | 95% | 待联调 | Express API + 转码优化 + 电商库表 + 双轨账户与加密 |
| storage（存储域） | 40% | 待对接 | R2 服务已写，需配置环境变量实际对接 |

## 一级：当前域

| 域 | 典型分支前缀 | 职责 |
|----|----------------|------|
| frontend | evo/fe-* | Vue 3 SPA：播放页动效/防误触、管理端 Dashboard、官网 Landing、社区发现页 |
| backend | evo/be-* | Express API：视频 CRUD、分组、双轨账号认证(加密Key)、多级实体架构、高压转码 |
| storage | evo/storage-* | Cloudflare R2 对象存储，CDN 分发视频资源 |

## 按域明细

### frontend（前端域）
- **核心能力**：
  - 播放页秒开（poster + critical CSS + code-split）
  - 播放页上滑 Swiper 切换与双击/防误触分离动效
  - 社交级路由转场动画、Landing 页动态载入
  - 官网 Landing（whatmint 品牌 · 永远系列 IP 实体图 · 价值主张）
  - 社区发现页（卡片网格 + 点赞/收藏/分享 + 实体心愿单关联）
- **当前分支**：`evo/fe-admin-upgrade`

### backend（后端域）
- **核心能力**：
  - 视频上传 → 9:16 转码（兼容性 yuv420p，高压缩 crf 28）
  - 认证与电商架构：`users` 注册账户、`series`/`groups` IP选购层级、`entities` 实体子账户
  - 对称加密 Key 下发与解析（无感鉴权）
  - 统计 API：支持默认榜单排行，去除冗余最新指标
  - 私有视频的 Entity 校验隔离
- **当前分支**：`evo/fe-admin-upgrade`

### storage（存储域）
- **核心能力**：S3 兼容 API 上传/删除，CDN 公共 URL 分发
- **状态**：代码已就绪（r2.js），需环境变量配置后激活
- **当前分支**：`evo/fe-admin-upgrade`
