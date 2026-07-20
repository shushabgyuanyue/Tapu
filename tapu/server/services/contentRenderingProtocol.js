import { cleanString } from './coreStore.js';

export function inferContentRenderer(content = {}) {
  const payload = content.payload || {};
  const template = content.content_definition_template || {};
  const renderer = cleanString(template.renderer)
    || cleanString(payload.renderer)
    || cleanString(content.renderer);
  if (renderer) return renderer;

  const kind = cleanString(content.content_kind || content.primary_modality);
  if (kind === 'video') return 'video.fullscreen';
  if (kind === 'audio') return 'audio.playback';
  if (kind === 'image') return 'image.single';
  return 'content.blocks';
}

export function buildContentPreviewRoute(content = {}) {
  const id = encodeURIComponent(content.id || '');
  if (!id) return '';
  const renderer = inferContentRenderer(content);
  if (renderer.startsWith('video.') || renderer.startsWith('ar.') || content.content_kind === 'video' || content.content_kind === 'ar') {
    return `/play/${id}`;
  }
  return `/content/${id}`;
}

export function buildContentDetailRoute(content = {}) {
  const id = encodeURIComponent(content.id || '');
  return id ? `/content/${id}` : '';
}
