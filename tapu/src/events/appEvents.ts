export const AUTH_CHANGED_EVENT = 'whatmint:auth-changed';
export const CONTENT_CHANGED_EVENT = 'whatmint:content-changed';

export type ContentChangeReason = 'created' | 'deleted' | 'drafted' | 'published' | 'bound';

export function emitAuthChanged() {
  window.queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
  });
}

export function emitContentChanged(reason: ContentChangeReason, contentId?: string) {
  window.dispatchEvent(new CustomEvent(CONTENT_CHANGED_EVENT, {
    detail: { reason, contentId },
  }));
}
