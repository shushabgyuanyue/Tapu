import { computed, ref } from 'vue';
import {
  deleteVideo,
  setEntityDefaultByToken,
} from '../api';
import { studioCopy } from '../copy';
import type { MintedItem } from './useMintStudioLibrary';

type Toast = { show: (text: string, duration?: number, type?: string) => void };

export function useMintStudioDetail(params: {
  toast?: Toast;
  loadStudioLibrary: () => void;
  removeMint: (item: MintedItem) => void;
}) {
  const selectedMintItem = ref<MintedItem | null>(null);
  const connectToken = ref('');
  const detailBusy = ref(false);

  const detailHasConnection = computed(() => !!selectedMintItem.value?.token);
  const detailConnectionLabel = computed(() => {
    const item = selectedMintItem.value;
    if (!item?.token) return studioCopy.detail.noObject;
    return item.subtitle ? `${item.subtitle} · ${item.token}` : item.token;
  });
  const detailCanConnect = computed(() => (
    selectedMintItem.value?.source === 'video' &&
    !!selectedMintItem.value.rawId &&
    !detailHasConnection.value
  ));
  const detailCanDelete = computed(() => selectedMintItem.value?.source === 'video' && !!selectedMintItem.value.rawId);
  const detailCanRemove = computed(() => selectedMintItem.value?.source === 'local');

  function openLibraryDetail(item: MintedItem) {
    selectedMintItem.value = item;
    connectToken.value = '';
  }

  function closeLibraryDetail() {
    selectedMintItem.value = null;
    connectToken.value = '';
  }

  function openSelectedPreview() {
    if (!selectedMintItem.value?.previewRoute) return;
    window.open(selectedMintItem.value.previewRoute, '_blank', 'noopener,noreferrer');
  }

  async function connectSelectedItem() {
    const item = selectedMintItem.value;
    const key = connectToken.value.trim();
    if (!item || !detailCanConnect.value || !key || detailBusy.value) return;
    detailBusy.value = true;
    const result = await setEntityDefaultByToken(key, item.rawId);
    detailBusy.value = false;
    if (result?.error) {
      params.toast?.show(result.error || studioCopy.detail.connectFailed, 1800, 'error');
      return;
    }
    params.toast?.show(studioCopy.detail.connectSuccess, 1600, 'success');
    closeLibraryDetail();
    params.loadStudioLibrary();
  }

  async function deleteSelectedItem() {
    const item = selectedMintItem.value;
    if (!item || detailBusy.value) return;
    if (detailCanRemove.value) {
      params.removeMint(item);
      params.toast?.show(studioCopy.detail.removeSuccess, 1400, 'success');
      closeLibraryDetail();
      return;
    }
    if (!detailCanDelete.value || !window.confirm(studioCopy.detail.deleteHint)) return;
    detailBusy.value = true;
    const result = await deleteVideo(item.rawId);
    detailBusy.value = false;
    if (result?.error) {
      params.toast?.show(result.error, 1800, 'error');
      return;
    }
    params.toast?.show(studioCopy.detail.deleteSuccess, 1600, 'success');
    closeLibraryDetail();
    params.loadStudioLibrary();
  }

  return {
    selectedMintItem,
    connectToken,
    detailBusy,
    detailConnectionLabel,
    detailCanConnect,
    detailCanDelete,
    detailCanRemove,
    openLibraryDetail,
    closeLibraryDetail,
    openSelectedPreview,
    connectSelectedItem,
    deleteSelectedItem,
  };
}
