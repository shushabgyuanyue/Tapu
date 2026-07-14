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

function mediaKindForAsset(asset) {
  const type = asset?.asset_type;
  const url = asset?.url || '';
  if (type === 'audio') return 'audio';
  if (type === 'video' || type === 'animation' || /\.(mp4|webm|mov)$/i.test(url)) return 'video';
  if (type === 'image' || type === 'illustration' || url) return 'image';
  return 'unsupported';
}

export function buildContentBlocksForDailyStickerEntry({ entry, assets = [], persona = null } = {}) {
  if (!entry) return [];

  const blocks = [
    {
      id: `${entry.id}-voice`,
      kind: 'text',
      body: persona?.voice,
      emphasis: 'quiet',
      tag: entry.mood || undefined,
    },
    {
      id: `${entry.id}-title`,
      kind: 'heading',
      body: entry.title,
    },
    {
      id: `${entry.id}-body`,
      kind: 'text',
      body: entry.body,
      emphasis: 'strong',
    },
  ];

  const assetUrls = new Set(assets.map(asset => asset?.url).filter(Boolean));
  if (entry.image_url && !assetUrls.has(entry.image_url)) {
    blocks.push({
      id: `${entry.id}-image`,
      kind: 'image',
      url: entry.image_url,
      alt: entry.title || persona?.name || '',
    });
  }

  for (const asset of assets) {
    blocks.push({
      id: asset.id || `${entry.id}-${asset.url}`,
      kind: mediaKindForAsset(asset),
      url: asset.url,
      alt: asset.alt_text,
      title: asset.alt_text,
      caption: asset.alt_text,
      metadata: {
        assetType: asset.asset_type,
        role: asset.role,
      },
    });
  }

  if (entry.quote) {
    blocks.push({
      id: `${entry.id}-quote`,
      kind: 'quote',
      body: entry.quote,
      caption: entry.quote_author,
    });
  }

  return blocks.filter(block => block.body || block.url);
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
