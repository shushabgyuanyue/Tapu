// Mint Space profile copy: backend-generated space descriptions, partner roles, and ambience labels.
export const mintSpaceCopy = {
  axes: {
    warmth: '温度',
    motion: '流动',
    mystery: '神秘',
    guarding: '守护',
    memory: '记忆',
    ritual: '仪式',
  },
  fallback: {
    unnamedPartner: '未命名存在',
    partnerRole: '灵境居民',
    partnerStatus: '它已经在你的 Mint Space 里留下了一个位置。',
    title: '我的 Mint Space',
    activeSubtitle: '一张正在形成的世界名片',
    emptySubtitle: '等待第一次相遇',
    activeSummary: count => `这里已经住进${count}位存在，空间正在显现出自己的光线、天气和性格。`,
    emptySummary: '邀请第一个存在进入这里之后，你的 Mint Space 会开始拥有自己的气质。',
    emptyDescription: '这里还保持着安静的空白。第一位进入的存在，会像一盏小灯，决定这里最初的温度和方向。它的性格还没有急着成形，正等待一次真正的相遇。',
    emptyStateTitle: 'Mint Space 还没有被点亮',
    emptyStateBody: '收到实体 token 后，把第一个存在接入这里；或者先去看看有哪些存在适合被邀请。',
  },
  presets: {
    tissuePuppy: {
      role: '温柔陪伴者',
      statusLine: '它总会在你需要的时候，往你身边靠近一点。',
      traits: ['柔软', '安慰', '守护'],
    },
    desktopSecret: {
      role: '桌面秘境入口',
      statusLine: '它让一张普通桌面，短暂打开另一层空间。',
      traits: ['秘境', '空间', '微光'],
    },
  },
  ambience: {
    weather: {
      warmth: '雨后晴光',
      motion: '有风的远方',
      mystery: '薄雾夜色',
      guarding: '安静灯塔',
      memory: '旧照片的金色',
      ritual: '微光仪式',
      fallback: '晴朗',
    },
    terrain: {
      warmth: '柔软草地',
      motion: '原野与道路',
      mystery: '书页森林',
      guarding: '靠近壁炉的房间',
      memory: '收藏故事的小屋',
      ritual: '石阶与微光',
      fallback: '安静房间',
    },
    lowLight: '低照度微光',
    warmLight: '午后暖光',
    clearLight: '清透天光',
  },
  description: {
    personality: topAxes => `它的空间人格偏向${topAxes}，更适合收藏那些被认真对待的小事。`,
    active: ({ names, hasMore, personality }) => `由${names}${hasMore ? '等伙伴' : ''}共同形成的空间，已经有了自己的呼吸和秩序。${personality}`,
  },
};
