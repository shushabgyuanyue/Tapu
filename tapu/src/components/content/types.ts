export type ContentBlockKind =
  | 'text'
  | 'heading'
  | 'image'
  | 'video'
  | 'audio'
  | 'quote'
  | 'action'
  | 'link'
  | 'card'
  | 'unsupported';

export type ContentBlock = {
  id?: string;
  kind: ContentBlockKind;
  role?: string;
  title?: string;
  body?: string;
  url?: string;
  alt?: string;
  poster?: string;
  caption?: string;
  tag?: string;
  href?: string;
  label?: string;
  action?: string;
  emphasis?: 'normal' | 'strong' | 'quiet';
  metadata?: Record<string, unknown>;
};

export type ContentRenderContext = {
  surface?: 'tap' | 'detail' | 'admin' | 'embed';
  themeColor?: string;
  objectName?: string;
  appCode?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
};

export type ContentCapabilityReport = {
  inlineVideo: boolean;
  webmVideo: boolean;
  mp4Video: boolean;
  audio: boolean;
  webShare: boolean;
};
