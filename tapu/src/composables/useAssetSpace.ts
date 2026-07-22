import { computed, onMounted, ref } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import {
  bindAssetInstance,
  clearToken,
  fetchAssetInstanceDefaultContent,
  fetchAssetInstances,
  fetchMintSpaceProfile,
  isLoggedIn,
  setAssetInstanceDefaultContent,
  transferAssetInstance,
  unbindAssetInstance,
} from '../api';
import type { MintSpaceProfile } from '../api/assets';
import { userCopy } from '../copy';
import mintSpacePortraitImage from '../IPimg/img/mint-space-collage.jpg';

type Toast = { show: (text: string, duration?: number, type?: string) => void };

export function useAssetSpace(params: {
  route: RouteLocationNormalizedLoaded;
  router: Router;
  toast?: Toast;
}) {
  const loading = ref(true);
  const loginRequired = ref(false);
  const spaceError = ref('');
  const assetInstances = ref<any[]>([]);
  const mintSpaceProfile = ref<MintSpaceProfile | null>(null);
  const selectedPartnerId = ref('');

  const bindKey = ref('');
  const bindMsg = ref('');
  const bindError = ref(false);
  const bindErrorCode = ref('');
  const suggestedDefaultContentId = ref('');

  const transferTargets = ref<Record<string, string>>({});
  const instanceDefaults = ref<Record<string, { content_id: string | null; content_title: string | null }>>({});
  const editingDefault = ref('');
  const editDefaultInput = ref('');

  const selectedPartner = computed(() => {
    const partners = mintSpaceProfile.value?.partners || [];
    if (selectedPartnerId.value) {
      return partners.find(partner => partner.id === selectedPartnerId.value) || null;
    }
    return partners[0] || null;
  });
  const selectedInstance = computed(() => assetInstances.value.find(instance => instance.id === selectedPartner.value?.id) || null);
  const isMintSpaceEmpty = computed(() => (mintSpaceProfile.value?.partners || []).length === 0);
  const permissionRecovery = computed(() => {
    if (!['ENTITY_ALREADY_BOUND', 'OBJECT_BOUND_TO_OTHER_ACCOUNT'].includes(bindErrorCode.value)) return null;
    return {
      title: userCopy.assets.permissionRecovery.title,
      body: userCopy.assets.permissionRecovery.body,
    };
  });
  const transferredInInstance = computed(() => assetInstances.value.find((instance) => {
    if (!instance.received_transfer_at) return false;
    return localStorage.getItem(`whatmint:transfer-welcome:${instance.id}:${instance.received_transfer_at}`) !== 'seen';
  }) || null);

  function isMintSpaceProfile(value: any): value is MintSpaceProfile {
    return !!value?.profile && Array.isArray(value.partners);
  }

  function applyMintSpaceProfile(result: any, instances = assetInstances.value) {
    if (isMintSpaceProfile(result)) {
      spaceError.value = '';
      mintSpaceProfile.value = result;
      const partners = result.partners || [];
      if (partners.length === 0) {
        selectedPartnerId.value = '';
        return;
      }
      if (!partners.some(partner => partner.id === selectedPartnerId.value)) {
        if (params.route.name === 'asset-instance' && selectedPartnerId.value) return;
        selectedPartnerId.value = partners[0].id;
      }
      return;
    }
    mintSpaceProfile.value = null;
    if (instances.length === 0) selectedPartnerId.value = '';
    spaceError.value = result?.error || userCopy.assets.mintSpace.profileError;
  }

  function assetImage(instance: any) {
    if (instance.product_image_url || instance.cover_url || instance.official_default_video_poster) {
      return instance.product_image_url || instance.cover_url || instance.official_default_video_poster;
    }
    const name = `${instance.group_name || ''}${instance.application_code || ''}`.toLowerCase();
    if (name.includes('贴纸') || name.includes('sticker')) return '/shop/figures/nfc-sticker.svg';
    if (name.includes('狗') || name.includes('puppy') || name.includes('纸巾')) return '/shop/figures/tissue-puppy.svg';
    return '/shop/figures/designer-toy-default.svg';
  }

  function displayToken(raw?: string) {
    return raw ? `${raw.slice(0, 16)}...${raw.slice(-4)}` : userCopy.assets.tokenMissing;
  }

  function formatContentId(id?: string) {
    return id ? id.replace(/-/g, '').toUpperCase() : '';
  }

  async function loadInstanceDefaults() {
    const defaults: Record<string, { content_id: string | null; content_title: string | null }> = {};
    await Promise.all(assetInstances.value.map(async (instance) => {
      const result = await fetchAssetInstanceDefaultContent(instance.id);
      defaults[instance.id] = result?.error
        ? { content_id: null, content_title: null }
        : result;
    }));
    instanceDefaults.value = defaults;
  }

  async function loadAssets() {
    loading.value = true;
    spaceError.value = '';
    try {
      const [profileResult, instanceRows] = await Promise.all([
        fetchMintSpaceProfile(),
        fetchAssetInstances(),
      ]);
      assetInstances.value = Array.isArray(instanceRows) ? instanceRows : [];
      applyMintSpaceProfile(profileResult, assetInstances.value);
      await loadInstanceDefaults();
    } catch {
      mintSpaceProfile.value = null;
      assetInstances.value = [];
      spaceError.value = userCopy.assets.mintSpace.profileError;
    } finally {
      loading.value = false;
    }
  }

  async function refreshInstances() {
    spaceError.value = '';
    try {
      const [profileResult, rows] = await Promise.all([
        fetchMintSpaceProfile(),
        fetchAssetInstances(),
      ]);
      assetInstances.value = Array.isArray(rows) ? rows : [];
      applyMintSpaceProfile(profileResult, assetInstances.value);
      await loadInstanceDefaults();
    } catch {
      spaceError.value = userCopy.assets.mintSpace.profileError;
    }
  }

  async function applySuggestedDefault(instanceId?: string) {
    if (!instanceId || !suggestedDefaultContentId.value) return;
    const result = await setAssetInstanceDefaultContent(instanceId, suggestedDefaultContentId.value);
    if (result?.success) {
      params.toast?.show(userCopy.assets.toasts.entityBoundDefaultSet, 2600, 'success');
    } else {
      params.toast?.show(result?.error || userCopy.assets.toasts.entityBoundDefaultLater, 2800, 'error');
    }
  }

  async function bindEntityToken(key: string) {
    const data = await bindAssetInstance(key);
    if (data.success) {
      await applySuggestedDefault(data.entity_id);
      await refreshInstances();
    }
    return data;
  }

  async function handleSmartBind(rawKey = bindKey.value) {
    bindMsg.value = '';
    bindError.value = false;
    bindErrorCode.value = '';
    const key = rawKey.trim();
    if (!key) {
      bindMsg.value = userCopy.assets.bind.emptySmart;
      bindError.value = true;
      return;
    }

    const result = await bindEntityToken(key);
    if (result.success) {
      bindMsg.value = userCopy.assets.bind.entitySuccessSpace;
      bindKey.value = '';
      return;
    }

    bindMsg.value = result.error || userCopy.assets.bind.failed;
    bindErrorCode.value = result.code || '';
    bindError.value = true;
  }

  async function handleBindEntity() {
    bindMsg.value = '';
    bindError.value = false;
    bindErrorCode.value = '';
    if (!bindKey.value.trim()) {
      bindMsg.value = userCopy.assets.bind.entityEmpty;
      bindError.value = true;
      return;
    }
    const data = await bindEntityToken(bindKey.value.trim());
    if (data.success) {
      bindMsg.value = userCopy.assets.bind.entitySuccess;
      bindKey.value = '';
    } else {
      bindMsg.value = data.error || userCopy.assets.bind.failed;
      bindErrorCode.value = data.code || '';
      bindError.value = true;
    }
  }

  function openAppealForCurrentToken() {
    const token = bindKey.value.trim();
    params.router.push({
      path: '/appeals',
      query: token ? { token } : {},
    });
  }

  function switchAccountForCurrentToken() {
    const token = bindKey.value.trim();
    clearToken();
    loginRequired.value = true;
    params.router.replace({
      path: '/assets',
      query: token ? { key: token } : {},
    });
  }

  function acknowledgeTransferWelcome() {
    const instance = transferredInInstance.value;
    if (!instance?.id || !instance.received_transfer_at) return;
    localStorage.setItem(`whatmint:transfer-welcome:${instance.id}:${instance.received_transfer_at}`, 'seen');
    params.toast?.show(userCopy.assets.transferWelcome.action, 1600, 'success');
  }

  async function handleUnbind(instanceId: string) {
    if (!window.confirm(userCopy.assets.confirms.unbind)) return;
    const data = await unbindAssetInstance(instanceId);
    if (data.success) {
      await refreshInstances();
      params.toast?.show(userCopy.assets.toasts.unbound, 2600, 'success');
    } else {
      params.toast?.show(data.error || userCopy.assets.toasts.unbindFailed, 2200, 'error');
    }
  }

  async function copyToken(token?: string) {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    params.toast?.show(userCopy.assets.toasts.tokenCopied, 1800, 'success');
  }

  function selectPartner(instanceId: string) {
    selectedPartnerId.value = instanceId;
  }

  function loadCanvasImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function downloadMintSpaceShareCard() {
    const profile = mintSpaceProfile.value?.profile;
    const partners = mintSpaceProfile.value?.partners || [];
    if (!profile) {
      params.toast?.show(userCopy.assets.toasts.shareFailed, 2200, 'error');
      return;
    }

    const palette = profile.ambience?.palette || ['#34c5d2', '#f2ae51', '#f7ead2'];
    const partnerNames = partners.slice(0, 5).map(partner => partner.name).join(' / ') || userCopy.assets.mintSpace.waitingPartner;
    const tags = [profile.personalityCode || 'MINT', ...(profile.traitLabels || [])].slice(0, 4);

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      params.toast?.show(userCopy.assets.toasts.shareFailed, 2200, 'error');
      return;
    }

    try {
      const collage = await loadCanvasImage(profile.collageImageUrl || mintSpacePortraitImage);
      const scale = Math.max(canvas.width / collage.width, canvas.height / collage.height);
      const width = collage.width * scale;
      const height = collage.height * scale;
      ctx.drawImage(collage, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    } catch {
      const gradient = ctx.createLinearGradient(0, 0, 1080, 1440);
      gradient.addColorStop(0, palette[0] || '#34c5d2');
      gradient.addColorStop(0.54, '#101b24');
      gradient.addColorStop(1, palette[1] || '#f2ae51');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1440);
    }

    ctx.fillStyle = 'rgba(4,10,14,0.50)';
    ctx.fillRect(0, 1040, 1080, 400);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.74)';
    ctx.font = '800 32px sans-serif';
    ctx.fillText('WHATMINT · MINT SPACE', 88, 132);
    ctx.fillStyle = '#fff';
    ctx.font = '900 82px sans-serif';
    ctx.fillText(profile.title, 88, 1040);
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.font = '400 34px sans-serif';
    ctx.fillText(partnerNames, 88, 1124);
    ctx.fillStyle = '#fff';
    ctx.font = '800 38px sans-serif';
    ctx.fillText(tags.join(' · '), 88, 1196);
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    ctx.font = '400 28px sans-serif';
    ctx.fillText(userCopy.assets.mintSpace.shareMotto, 88, 1288);

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = userCopy.assets.mintSpace.shareFileName;
    link.click();
    params.toast?.show(userCopy.assets.toasts.shareSaved, 2200, 'success');
  }

  async function handleTransfer(instanceId: string) {
    const toUsername = transferTargets.value[instanceId]?.trim();
    if (!toUsername) {
      params.toast?.show(userCopy.assets.toasts.transferTargetRequired, 2200, 'error');
      return;
    }
    if (!window.confirm(userCopy.assets.confirms.transfer(toUsername))) return;

    const data = await transferAssetInstance(instanceId, toUsername);
    if (data.success) {
      params.toast?.show(userCopy.assets.toasts.transferSuccess, 2200, 'success');
      transferTargets.value[instanceId] = '';
      await refreshInstances();
    } else {
      params.toast?.show(data.error || userCopy.assets.toasts.transferFailed, 2200, 'error');
    }
  }

  function startEditDefault(instanceId: string) {
    editingDefault.value = instanceId;
    editDefaultInput.value = suggestedDefaultContentId.value || instanceDefaults.value[instanceId]?.content_id || '';
  }

  async function saveDefault(instanceId: string, contentId = editDefaultInput.value) {
    if (!contentId.trim()) {
      params.toast?.show(userCopy.assets.toasts.contentIdRequired, 2200, 'error');
      return;
    }

    const data = await setAssetInstanceDefaultContent(instanceId, contentId.trim());
    if (data.success) {
      params.toast?.show(userCopy.assets.toasts.defaultUpdated, 2200, 'success');
      instanceDefaults.value[instanceId] = await fetchAssetInstanceDefaultContent(instanceId);
      editingDefault.value = '';
    } else {
      params.toast?.show(data.error || userCopy.assets.toasts.updateFailed, 2200, 'error');
    }
  }

  function openExperience(instance: any) {
    const token = instance.token || instance.entity_key;
    if (!token) return;
    window.open(`/play?key=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
  }

  function openMintForInstance(instance: any) {
    const token = instance.token || instance.entity_key;
    params.router.push(token ? { path: '/mint', query: { key: token } } : '/mint');
  }

  function openShop() {
    params.router.push('/shop');
  }

  onMounted(async () => {
    const keyFromUrl = typeof params.route.query.key === 'string' ? params.route.query.key : '';
    suggestedDefaultContentId.value = typeof params.route.query.defaultContentId === 'string'
      ? params.route.query.defaultContentId
      : '';
    if (keyFromUrl) bindKey.value = keyFromUrl;

    if (!isLoggedIn()) {
      loginRequired.value = true;
      loading.value = false;
      return;
    }

    await loadAssets();

    if (keyFromUrl) {
      await handleSmartBind(keyFromUrl);
      const query: Record<string, string> = {};
      if (suggestedDefaultContentId.value) query.defaultContentId = suggestedDefaultContentId.value;
      params.router.replace({ path: '/assets', query });
    }
  });

  return {
    loading,
    loginRequired,
    spaceError,
    assetInstances,
    mintSpaceProfile,
    selectedPartner,
    selectedInstance,
    isMintSpaceEmpty,
    bindKey,
    bindMsg,
    bindError,
    bindErrorCode,
    permissionRecovery,
    transferredInInstance,
    suggestedDefaultContentId,
    transferTargets,
    instanceDefaults,
    editingDefault,
    editDefaultInput,
    assetImage,
    displayToken,
    formatContentId,
    loadAssets,
    handleSmartBind,
    handleBindEntity,
    openAppealForCurrentToken,
    switchAccountForCurrentToken,
    acknowledgeTransferWelcome,
    handleUnbind,
    copyToken,
    handleTransfer,
    selectPartner,
    downloadMintSpaceShareCard,
    startEditDefault,
    saveDefault,
    openExperience,
    openMintForInstance,
    openShop,
  };
}
