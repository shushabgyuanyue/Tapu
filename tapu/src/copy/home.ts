// Landing page copy: customer-facing brand narrative, hero sections, and homepage entry actions.
export const homeCopy = {
  hero: {
    eyebrow: 'WhatMint',
    title: '邀请有灵的存在，慢慢形成你的 Mint Space。',
    subtitle: '现实里的一个小物，可以承载安慰、祝愿、答案和关系。WhatMint 让这些被赋予意义的存在进入数字灵境，并在触碰、创作和相遇中继续生长。',
    primaryShop: '邀请新的存在',
    secondarySpace: '进入 Mint Space',
  },
  activity: {
    detailBack: '回到首页',
    detailMissing: '这个相遇还在整理中。',
    detailPrimary: '进入相关入口',
    title: '这个世界正在出现新的相遇',
    subtitle: '首页不是货架，而是 WhatMint 正在呼吸的入口。新的 IP、官方体验和用户创作会让这个世界持续变得不同。',
    featured: {
      id: 'mint-space-notes',
      label: 'World Update',
      title: '关系杂记开始进入 Mint Space',
      body: 'IP 之间的情绪关系会以小故事的方式被看见。',
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
        id: 'mint-space-notes',
        label: '世界观',
        title: '关系杂记开始进入 Mint Space',
        body: 'IP 之间的情绪关系会以小故事的方式被看见。',
        hero: '灵境杂记不是日志，也不是任务提醒。它是一种很轻的世界观回声，让用户感觉自己的 Mint Space 里真的住着一些正在彼此靠近的存在。',
        sections: [
          {
            title: '杂记表达什么',
            body: '它表达 IP 之间的关系、用户空间的气质，以及这个世界正在发生的小事。比如纸巾小狗靠近答案之书，因为它发现许多悲伤来自没有想明白。',
          },
          {
            title: '为什么先由官方提供',
            body: '第一版先用官方文案保证调性：有灵气、有个性、成熟克制。后续再根据 IP 设定、关系矩阵和用户拥有组合，生成更丰富的版本。',
          },
        ],
        actionLabel: '进入 Mint Space',
        actionRoute: '/assets',
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
        name: '答案之书',
        label: '自我回应',
        description: '一本帮助你听见自己答案的书。',
        imageName: '永远系列-祈福小狗-合集.png',
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
    title: '拥有之后，你得到的是一个会变化的灵境',
    subtitle: 'Mint Space 是用户最终想打造的个人世界。每一次邀请、绑定和创作，都会让它拥有不同的气质。',
    action: '进入我的 Mint Space',
    inviteAction: '邀请新的伙伴',
    portraitTitle: '初晴后的安静房间',
    portraitBody: '这里住着三位小小的存在：一个负责温柔，一个负责答案，一个负责祝愿。它们让这个空间显得清透、克制，也有一点不声张的浪漫。',
    traits: ['温柔型', '留白感', '轻仪式', '适合分享'],
    partners: [
      {
        name: '纸巾小狗',
        status: '正在练习一次 AR 出场',
      },
      {
        name: '答案之书',
        status: '今天给出了一句很轻的回答',
      },
      {
        name: '祈福小狗',
        status: '把祝愿收在房间角落',
      },
    ],
    notes: [
      '纸巾小狗总喜欢靠近答案之书，因为它发现，很多悲伤其实来自没有想明白的事情。',
      '祈福小狗不常说话，但每次天光变亮，它都会把房间整理得更温柔一点。',
    ],
  },
  studioSection: {
    eyebrow: 'Mint Studio',
    title: '关系可以继续被赋予新的意义',
    subtitle: 'WhatMint 不是买完结束。用户可以通过创作中心，把祝福、声音、影像和专属内容铸造成新的内容资产。',
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
        body: '内容节点可以更新，关系也可以随着使用慢慢生长。',
      },
    ],
  },
  footer: {
    disclaimer: '免责声明',
    privacy: '隐私政策',
  },
};
