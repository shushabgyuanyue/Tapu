const SCENE_CATEGORIES = ['旅行', '工作学习', '送礼', '摆件'];

const APP_SCENES: Record<string, string[]> = {
  'tissue-puppy': ['送礼', '摆件'],
  'desktop-secret': ['工作学习', '摆件'],
};

function rawTagsFor(subject: any) {
  if (Array.isArray(subject.display_tags_list)) {
    return subject.display_tags_list.map((tag: string) => String(tag).trim()).filter(Boolean);
  }
  return String(subject.display_tags || '')
    .split(/[，,\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function resolveIpScenes(subject: any) {
  const applicationCode = subject.application_code || subject.applicationCode || subject.code || '';
  const mappedScenes = APP_SCENES[applicationCode];
  if (mappedScenes) return mappedScenes;
  return rawTagsFor(subject).filter((tag: string) => SCENE_CATEGORIES.includes(tag));
}

export function allSceneCategories() {
  return SCENE_CATEGORIES;
}
