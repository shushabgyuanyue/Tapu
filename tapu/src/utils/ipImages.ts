import tissuePuppyImage from '../IPimg/img/纸巾小狗.png';

type IpImageSubject = {
  name?: string;
  code?: string;
  applicationCode?: string;
  imageUrl?: string;
};

function isTissuePuppy(subject: IpImageSubject) {
  const text = `${subject.name || ''} ${subject.code || ''} ${subject.applicationCode || ''}`.toLowerCase();
  return text.includes('纸巾小狗') || text.includes('tissue-puppy') || text.includes('tissue_puppy');
}

export function resolveIpImage(subject: IpImageSubject, fallback = '/shop/figures/designer-toy-default.svg') {
  if (isTissuePuppy(subject)) return tissuePuppyImage;
  return subject.imageUrl || fallback;
}

const whatmintIpImageUrls: Record<string, string> = {
  'whatmint-ip-image:tissue-puppy': tissuePuppyImage,
};

export function resolveWhatmintAssetUrl(url?: string) {
  if (!url) return '';
  return whatmintIpImageUrls[url] || url;
}
