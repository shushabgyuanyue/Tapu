export function buildContentBlocksForAnswerCard(card) {
  if (!card) return [];

  return [
    {
      id: `${card.id}-answer`,
      kind: 'heading',
      body: card.answer,
      tag: card.tag || '当下',
    },
    {
      id: `${card.id}-response`,
      kind: 'text',
      body: card.response,
      emphasis: 'normal',
    },
    {
      id: `${card.id}-action`,
      kind: 'action',
      title: '小动作',
      action: card.action,
    },
  ].filter(block => block.body || block.action);
}

export function buildTapResponse({ object, app, content, actions = [], permissions = {} }) {
  return {
    protocol: {
      name: 'whatmint.tap',
      version: '0.1',
    },
    object,
    app,
    content,
    actions,
    permissions,
  };
}
