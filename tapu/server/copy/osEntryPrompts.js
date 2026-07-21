// OS entry prompt copy: backend-configured Space invitation wording for NFC/player and other app entry surfaces.
export const osEntryPromptCopy = {
  default: {
    nfcUnbound: {
      title: '把这个存在接入你的 Mint Space',
      body: '你已经触碰到它了。接入后，它会成为你空间里的伙伴，也可以继续维护默认体验。',
      primaryLabel: '接入 Mint Space',
      secondaryLabel: '了解 WhatMint',
    },
    nfcBound: {
      title: '进入 Mint Space',
      body: '这位伙伴已经住进某个 Mint Space。需要管理或继续邀请新伙伴时，可以回到空间。',
      primaryLabel: '进入 Mint Space',
    },
  },
  'tissue-puppy': {
    nfcUnbound: {
      title: '让纸巾小狗住进你的 Mint Space',
      body: '如果这是你手里的纸巾小狗，可以把它接入空间。之后每次触碰，它都会打开你为它选择的默认体验。',
      primaryLabel: '接入纸巾小狗',
      secondaryLabel: '看看 WhatMint',
    },
    nfcBound: {
      title: '回到纸巾小狗的空间',
      body: '它已经被接入 Mint Space。需要维护默认体验时，可以回到空间处理。',
      primaryLabel: '进入 Mint Space',
    },
  },
};
