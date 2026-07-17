export const appCopy = {
  earphoneGirl: {
    fallbackTitle: '耳机小姐',
    fallbackSubtitle: '她正在把路上听见的小事带回来。',
    missingToken: '缺少耳机小姐链接，请确认写入地址是否完整。',
    mark: 'WhatMint Earphone Girl',
    objectFallback: '耳机贴纸',
    loading: {
      title: '她正在调好声音',
      body: '故事还在路上，等一下就会抵达。',
    },
    error: {
      title: '这次没有听清',
    },
    progress: {
      prefix: '故事',
      exhausted: '她已经讲完一轮，正在从第一段重新出发。',
    },
    actions: {
      completed: '我听完了',
      completing: '记录中...',
      completedMessage: '她记住了这一次，下次会从下一段继续。',
      completedFallback: '已经记住这次故事。',
      nextReady: '下一段已经在路上。',
    },
    empty: {
      title: '她还没有带回第一段故事',
      body: '官方内容创建后，这枚耳机贴纸会按自己的队列一点点讲下去。',
    },
    footer: ['按实例推进', '声音和插画', '关系入口'],
  },
  answerBook: {
    fallbackTitle: '答案之书',
    fallbackTag: '当下',
    actionTitle: '小动作',
    missingToken: '缺少答案之书 token。请确认写入的是完整链接。',
    copyTextActionPrefix: '小动作：',
    header: {
      brand: 'WhatMint',
      app: '答案之书',
    },
    loading: {
      title: '正在翻到这一页',
      body: '把问题留在心里。答案不需要知道全部细节。',
    },
    error: {
      title: '这本书暂时没说话',
    },
    ritual: '心里默念一个问题，然后看这一页。',
    actions: {
      draw: '再问一次',
      drawing: '翻页中...',
      copy: '复制答案',
      copied: '已复制',
    },
  },
  moment: {
    fallbackTitle: '纪念瞬间',
    missingToken: '缺少纪念瞬间链接，请确认写入地址是否完整。',
    mark: 'WhatMint Moment',
    loading: {
      title: '正在取出这一刻',
      body: '现实里的物正在打开它保存的时间。',
    },
    error: {
      title: '这个瞬间暂时没有打开',
    },
    footer: {
      defaultObject: '一件被保存过的物',
      intent: (label: string) => `意图：${label}`,
      recipient: (name: string) => `送给：${name}`,
      touchHint: '碰一下，回到那一刻',
    },
  },
  travelTrail: {
    fallbackTitle: '旅行轨迹',
    fallbackSubtitle: '每次出发前碰一下行李箱，回来后再把这一站接进人生轨迹。',
    fallbackLifeQuestion: '我的人生走过了哪些地方？',
    fallbackObjectLabel: '这件会移动的物品',
    missingToken: '缺少旅行轨迹链接，请确认写入地址是否完整。',
    stamps: {
      brand: 'WMT',
      signal: 'NFC',
    },
    mark: 'WhatMint Travel Trail',
    loading: {
      title: '正在展开这段路线',
      body: (objectLabel: string) => `${objectLabel}里的地点正在排成一条线。`,
    },
    error: {
      title: '这条轨迹暂时没有打开',
    },
    stops: (count: number, objectLabel: string) => `${count} stops · ${objectLabel}`,
    emptyMap: {
      title: '还没有出发',
      body: '先写下第一段下一站，让这件物品开始拥有方向。',
    },
    activeRitual: {
      kicker: '出发前',
      nextTitle: (place: string) => `下一站：${place}`,
      noNote: '它还没有成为过去，但已经被这件行李轻轻记住。',
      returnPlaceholder: '回来后，可以给这一站留一句话',
      saving: '记录中...',
      action: '我回来了，把这一站加入轨迹',
    },
    plan: {
      kicker: '出发的仪式',
      title: '写下下一站',
      placePlaceholder: '例如：东京 / 京都 / 冰岛黑沙滩',
      notePlaceholder: '一句出发前的心情，可选',
      saving: '写入中...',
      action: '让行李记住它',
    },
    messages: {
      planned: (place: string) => `下一站：${place}。出发前，行李已经记住它了。`,
      returned: (place: string) => `${place}已经加入你的生命轨迹。`,
      returnedFallback: '这一站',
    },
  },
  check: {
    fallbackTitle: 'Check',
    fallbackSubtitle: '碰一下这个物件，完成一次轻轻的检查。',
    fallbackObjectLabel: '这个物件',
    missingToken: '缺少 Check 链接，请确认写入地址是否完整。',
    cornerStamp: 'CHECK',
    mark: 'WhatMint Check',
    loading: {
      title: '正在打开这份检查',
      body: (objectLabel: string) => `${objectLabel}正在把要确认的东西排好。`,
    },
    error: {
      title: '这份 Check 暂时没有打开',
    },
    progress: {
      complete: '检查完成',
      checking: '正在检查',
      completeBody: '可以安心带着它出门了。',
      checkingBody: '不需要完美，只需要临出门前多看一眼。',
    },
    empty: {
      title: '还没有检查项目',
      body: '给这个物件加上第一项需要确认的东西。',
    },
    form: {
      itemLabel: '自定义加一项',
      itemPlaceholder: '例如：备用电池 / 孩子的水杯',
      hintLabel: '一句提醒，可选',
      hintPlaceholder: '用一句话帮未来的自己记住原因',
      saving: '保存中...',
      action: '加入 Check',
    },
    actions: {
      reset: '重新检查',
    },
    messages: {
      checked: (label: string) => `已确认：${label}`,
      unchecked: (label: string) => `已取消：${label}`,
      added: '这个物件多记住了一项检查。',
      reset: '已重新开始这次检查。',
    },
  },
};
