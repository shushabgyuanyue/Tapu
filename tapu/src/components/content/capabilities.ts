import type { ContentCapabilityReport } from './types';

let cachedReport: ContentCapabilityReport | null = null;

export function detectContentCapabilities(): ContentCapabilityReport {
  if (cachedReport) return cachedReport;

  const video = typeof document !== 'undefined' ? document.createElement('video') : null;
  const audio = typeof document !== 'undefined' ? document.createElement('audio') : null;

  cachedReport = {
    inlineVideo: !!video && 'playsInline' in video,
    mp4Video: !!video?.canPlayType?.('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    webmVideo: !!video?.canPlayType?.('video/webm; codecs="vp8, vorbis"'),
    audio: !!audio?.canPlayType,
    webShare: typeof navigator !== 'undefined' && 'share' in navigator,
  };

  return cachedReport;
}

export function mediaExtension(url = '') {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  const match = clean.match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

export function canRenderVideoUrl(url = '') {
  const capabilities = detectContentCapabilities();
  const ext = mediaExtension(url);
  if (ext === 'mp4' || ext === 'm4v' || ext === 'mov') return capabilities.mp4Video;
  if (ext === 'webm') return capabilities.webmVideo;
  return capabilities.mp4Video || capabilities.webmVideo;
}
