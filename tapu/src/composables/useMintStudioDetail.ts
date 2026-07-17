import { computed, ref } from 'vue';
import { deleteContentInstance } from '../api';
import { studioCopy } from '../copy';
import { emitContentChanged } from '../events/appEvents';
import { canManageMintedContent, type MintedItem } from './useMintStudioLibrary';

type Toast = { show: (text: string, duration?: number, type?: string) => void };

export function useMintStudioDetail(params: {
  toast?: Toast;
  loadStudioLibrary: () => void;
  removeContentItem: (item: MintedItem) => void;
}) {
  const selectedMintItem = ref<MintedItem | null>(null);
  const detailBusy = ref(false);

  const detailCanDelete = computed(() => (
    !!selectedMintItem.value && canManageMintedContent(selectedMintItem.value)
  ));

  function openLibraryDetail(item: MintedItem) {
    selectedMintItem.value = item;
  }

  function closeLibraryDetail() {
    selectedMintItem.value = null;
  }

  function openSelectedPreview() {
    if (!selectedMintItem.value?.previewRoute) return;
    window.open(selectedMintItem.value.previewRoute, '_blank', 'noopener,noreferrer');
  }

  async function deleteMintedItem(item: MintedItem | null = selectedMintItem.value) {
    if (!item || detailBusy.value || !canManageMintedContent(item)) return;
    if (!window.confirm(studioCopy.detail.confirmDelete(item.title))) return;
    detailBusy.value = true;
    const result = await deleteContentInstance(item.rawId);
    detailBusy.value = false;
    if (result?.error) {
      params.toast?.show(result.error, 1800, 'error');
      return;
    }
    params.removeContentItem(item);
    emitContentChanged('deleted', item.rawId);
    params.toast?.show(studioCopy.detail.deleteSuccess, 1600, 'success');
    if (selectedMintItem.value?.id === item.id) closeLibraryDetail();
    params.loadStudioLibrary();
  }

  return {
    selectedMintItem,
    detailBusy,
    detailCanDelete,
    openLibraryDetail,
    closeLibraryDetail,
    openSelectedPreview,
    deleteSelectedItem: deleteMintedItem,
    deleteMintedItem,
  };
}
