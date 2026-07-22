// Landing page copy: customer-facing brand narrative, hero sections, and homepage entry actions.
export const homeCopy = {
  hero: {
    eyebrow: 'WhatMint',
    title: '把现实世界，变成可以被触碰的界面。',
    subtitle: 'WhatMint 让日常物品在关键生活场景中获得数字表达。一个贴纸、摆件或礼物，不只是多了功能，而是补上它原本想表达却无法表达的部分。',
    primaryShop: '邀请新的存在',
    secondarySpace: '进入 Mint Space',
  },
  activity: {
    detailBack: '回到首页',
    detailMissing: '这个相遇还在整理中。',
    detailPrimary: '进入相关入口',
    title: '这个世界正在出现新的相遇',
    subtitle: '首页不是货架，而是 WhatMint 正在发生的入口。新的 IP、官方体验和用户创作会让现实中的小物不断获得新的表达。',
    featured: {
      id: 'desktop-secret-ar',
      label: 'Scene Update',
      title: '桌面秘境开始测试 AR 场景',
      body: '碰一下桌面贴纸，让一个数字秘境出现在真实桌面上。',
    },
    cards: [
      {
        id: 'paper-puppy-ar',
        label: '新抵达',
        title: '纸巾小狗正在测试 AR 召唤',
        body: '一次触碰，把一个温柔的小存在带到屏幕中央。',
        hero: '纸巾小狗不是一段视频，而是一个可以被召唤到眼前的小小存在。AR 只是渲染方式，真正重要的是：实体触碰后，它开始拥有自己的出场。',
        sections: [
          {
            title: '为什么是 AR',
            body: '纸巾小狗的情绪价值不是“看完一段内容”，而是它真的来到你身边。我们会先用轻量的摄像头叠加和透明视频完成体验验证，再逐步升级到更稳定的空间渲染。',
          },
          {
            title: '它如何稳定出现',
            body: '用户只需要触碰实体，看见纸巾小狗以合适的方式出现。背后的资源处理、播放适配和权限判断会尽量藏起来，前台只保留它的出场气质、节奏和表达。',
          },
        ],
        actionLabel: '认识纸巾小狗',
        actionRoute: '/shop',
      },
      {
        id: 'desktop-secret-ar',
        label: '新体验',
        title: '桌面秘境开始测试 AR 场景',
        body: '它不是给桌面多加一个功能，而是让桌面在专注、休息或重新开始时拥有一个可被看见的秘境入口。',
        hero: '桌面秘境是 WhatMint “现实世界 UI”的典型样本：用户触碰桌面上的实体标记，浏览器打开摄像头，在贴纸附近看到一个轻量的数字场景。',
        sections: [
          {
            title: '为什么属于桌面',
            body: '桌面本来就是学习、工作和短暂出神的地方。桌面秘境让这个场景多一个可触发的空间表达，而不是要求用户打开一个复杂应用。',
          },
          {
            title: 'OS 承担什么',
            body: 'token 解析、摄像头授权、AR 渲染、内容资源和绑定提示都由 OS 统一处理；应用只决定这个秘境该如何出现、停留和离开。',
          },
        ],
        actionLabel: '认识桌面秘境',
        actionRoute: '/shop',
      },
    ],
  },
  ipSection: {
    eyebrow: 'Invitation Hall',
    title: '认识可以进入你生活的存在',
    subtitle: '这里展示的不是商品参数，而是每个 IP 的人格、场景和触碰后的应用体验。',
    action: '去商城看看',
    fallbackCards: [
      {
        name: '纸巾小狗',
        label: '安慰与温柔',
        description: '总会在你需要的时候递上一点温柔。',
        imageName: '永远系列-纸巾小狗-合集.png',
      },
      {
        name: '桌面秘境',
        label: '桌面与空间',
        description: '碰一下桌面贴纸，让一处小秘境出现在现实桌面。',
        imageName: '永远系列-守护小狗-合集.png',
      },
      {
        name: '祈福小狗',
        label: '祝愿与仪式',
        description: '把一句祝福变成可以被触碰的长期陪伴。',
        imageName: '永远系列-祈福小狗-合集.png',
      },
    ],
  },
  mintSpaceSection: {
    eyebrow: 'Mint Space',
    title: '拥有之后，你会得到一组属于自己的现实入口',
    subtitle: 'Mint Space 聚合你已经接入的实体和场景。它不是资产仓库，而是查看、管理和继续触发这些数字表达的个人入口。',
    action: '进入我的 Mint Space',
    inviteAction: '邀请新的伙伴',
    portraitTitle: '由现实物件点亮的私人界面',
    portraitBody: '这里收着几种不同的生活瞬间：需要安慰时的小狗、桌面上短暂出现的秘境、以及后续继续接入的新场景。它们共同组成你的 Mint Space。',
    traits: ['现实入口', '场景触发', '轻量表达', '可继续创造'],
    partners: [
      {
        name: '纸巾小狗',
        status: '在需要安慰的瞬间出现',
      },
      {
        name: '桌面秘境',
        status: '让桌面出现一个可触发的数字场景',
      },
      {
        name: '新的存在',
        status: '等待按新核心范式接入',
      },
    ],
  },
  studioSection: {
    eyebrow: 'Mint Studio',
    title: '表达可以继续被创造',
    subtitle: 'WhatMint 不是买完结束。用户可以通过创作中心，把祝福、声音、影像和专属内容铸造成物体下一次触碰时的表达。',
    action: '开始创作',
    examples: [
      {
        title: '给朋友做一只纸巾小狗',
        body: '上传一段影像或 AR 资源，让这只小狗在对方触碰时出现。',
      },
      {
        title: '把一句祝福留在实体里',
        body: '让一个小物在生日、告别或重逢时，承担更轻、更长久的表达。',
      },
      {
        title: '为一个 IP 续写新的体验',
        body: '内容节点可以更新，让同一个实体在新的生活时刻表达新的意义。',
      },
    ],
  },
  footer: {
    disclaimer: '免责声明',
    privacy: '隐私政策',
  },
};
