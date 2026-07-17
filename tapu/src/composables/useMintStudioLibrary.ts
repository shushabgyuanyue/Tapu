import { computed, ref } from 'vue';
import {
  fetchMintStudioLibrary,
  isLoggedIn,
  type MintStudioLibraryItem,
} from '../api';
import { studioCopy } from '../copy';

export type MintedItem = {
  id: string;
  rawId: string;
  title: string;
  appName: string;
  appCode?: string;
  token: string;
  previewRoute: string;
  thumb?: string;
  status: 'draft' | 'published' | 'processing' | string;
  source: 'content';
  subtitle?: string;
  createdAt: string;
};

function mergeMintedItems(items: MintedItem[]) {
  const seen = new Set<string>();
  return items
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 100);
}

function libraryItemToMintedItem(item: MintStudioLibraryItem): MintedItem {
  const [, ...idParts] = String(item.id || '').split(':');
  return {
    id: item.id,
    rawId: idParts.join(':') || item.id,
    title: item.title || item.appName || studioCopy.defaultTitle,
    appName: item.appName || item.appCode || 'WhatMint',
    appCode: item.appCode,
    token: item.tokenCompact || item.token || '',
    previewRoute: item.previewRoute || '',
    thumb: item.thumb || undefined,
    status: item.status || 'draft',
    source: 'content',
    subtitle: item.subtitle || item.status || '',
    createdAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

export function mintedStatusText(item: MintedItem) {
  if (item.status === 'published') return studioCopy.libraryStatus.published;
  if (item.status === 'draft') return studioCopy.libraryStatus.draft;
  if (item.status === 'processing') return studioCopy.libraryStatus.processing;
  return studioCopy.libraryStatus.content;
}

export function canManageMintedContent(item: MintedItem | null | undefined) {
  return !!item?.rawId;
}

export function useMintStudioLibrary() {
  const serverMintedItems = ref<MintedItem[]>([]);
  const loggedIn = ref(isLoggedIn());
  const libraryLoading = ref(false);
  const mintedItems = computed(() => (
    loggedIn.value ? mergeMintedItems(serverMintedItems.value) : []
  ));

  async function loadStudioLibrary() {
    loggedIn.value = isLoggedIn();
    if (!loggedIn.value) {
      serverMintedItems.value = [];
      return;
    }
    libraryLoading.value = true;
    try {
      const result = await fetchMintStudioLibrary();
      serverMintedItems.value = Array.isArray(result?.items)
        ? result.items.map(libraryItemToMintedItem)
        : [];
    } catch {
      serverMintedItems.value = [];
    } finally {
      libraryLoading.value = false;
    }
  }

  function removeContentItem(item: MintedItem) {
    serverMintedItems.value = serverMintedItems.value.filter(existing => existing.id !== item.id);
  }

  return {
    libraryLoading,
    mintedItems,
    loadStudioLibrary,
    removeContentItem,
  };
}
