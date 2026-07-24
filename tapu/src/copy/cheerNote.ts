// Cheer Note copy: customer-facing cheering modes and future AI prompt frames.
export type CheerModeId = 'welcome_back' | 'task_start' | 'task_complete' | 'unfinished_but_full' | 'tiny_win';

export const cheerNoteCopy = {
  meta: {
    routeTitle: '喝彩便签',
    appCode: 'cheer-note',
    object: '办公桌上的礼炮便签',
    behavior: '写下今天要做点啥，然后让它为你放礼炮',
    meaning: '把你愿意开始、经过和回来的瞬间认真看见。',
  },
  lifecycle: {
    ttlHours: 24,
    maxActiveItems: 100,
  },
  composer: {
    label: '今天要做点啥',
    placeholder: '比如：先把方案打开，或者去上个厕所',
    open: '添加一件小事',
    submit: '添加',
    close: '先等等',
    empty: '先写一句嘛，我已经把小礼炮拿好了。',
  },
  modes: {
    welcome_back: {
      label: '欢迎回来',
      cannon: '晨光礼炮',
      intensity: 'medium',
      tone: 'soft',
      title: '你回来啦',
      lines: [
        '你回来啦。我刚刚还在想，今天第一声礼炮要留给什么时候。',
      ],
      aiFrame: '欢迎用户回到桌前，表达等待和陪伴，不要求立刻高效。',
    },
    task_start: {
      label: '写下理由',
      cannon: '小小开场炮',
      intensity: 'tiny',
      tone: 'bright',
      title: '写下来了',
      lines: [
        '好，我们有地方开始了。小小响一下，给你的有计划。',
      ],
      aiFrame: '庆祝用户写下一件事，把它当作见面理由和一个被看见的开始。',
    },
    task_complete: {
      label: '完成喝彩',
      cannon: '炸开礼炮',
      intensity: 'large',
      tone: 'gold',
      title: '做完了',
      lines: [
        '做完了！我等这一刻等得有点开心。',
      ],
      aiFrame: '确认用户写下的事被完成，表达高兴和欣赏，可以稍微更热烈。',
    },
    unfinished_but_full: {
      label: '没完成也喝彩',
      cannon: '满载礼炮',
      intensity: 'medium',
      tone: 'warm',
      title: '今天不是空白页',
      lines: [
        '没做完也没关系。我知道你今天不是没过。',
      ],
      aiFrame: '面对没走到终点的事，降低羞耻感，承认这一天被认真经过。',
    },
    tiny_win: {
      label: '小事也算',
      cannon: '离谱礼炮',
      intensity: 'small',
      tone: 'spark',
      title: '这也算，当然算',
      lines: [
        '这种小事最容易被忽略，但我不想漏掉它。',
      ],
      aiFrame: '庆祝微小、琐碎、甚至有点荒诞的真实行动。',
    },
  },
  taskStates: {
    fresh: '我记住了。',
    pressing: '我在憋一个大的。',
    done: '这件事已经被你拿下了。',
    pending: '先放这儿，我还陪你。',
  },
};
