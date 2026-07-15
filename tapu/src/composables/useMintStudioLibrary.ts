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
  status: 'done' | 'collected' | 'work' | 'video' | 'asset' | 'collection' | string;
  source?: string;
  subtitle?: string;
  createdAt: string;
};

type RememberMintInput = {
  id: string;
  title: string;
  appName: string;
  token: string;
  previewRoute: string;
  thumb?: string;
  status?: MintedItem['status'];
};

const MINT_HISTORY_KEY = 'whatmint_mint_studio_history';

function mergeMintedItems(items: MintedItem[]) {
  const seen = new Set<string>();
  return items
    .filter(item => {
      const key = item.token ? `${item.appName}:${item.token}` : item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 80);
}

function libraryItemToMintedItem(item: MintStudioLibraryItem): MintedItem {
  const [sourcePrefix, ...idParts] = String(item.id || '').split(':');
  return {
    id: item.id,
    rawId: idParts.join(':') || item.id,
    title: item.title || item.appName || 'Untitled',
    appName: item.appName || item.appCode || 'WhatMint',
    appCode: item.appCode,
    token: item.tokenCompact || item.token || '',
    previewRoute: item.previewRoute || '',
    thumb: item.thumb || undefined,
    status: item.source || item.status || 'work',
    source: item.source || sourcePrefix,
    subtitle: item.subtitle || item.status || '',
    createdAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  };
}

export function mintedStatusText(item: MintedItem) {
  if (item.source === 'work' || item.status === 'work') return studioCopy.libraryStatus.work;
  if (item.source === 'video' || item.status === 'video') return studioCopy.libraryStatus.video;
  if (item.source === 'asset' || item.status === 'asset' || item.status === 'collected') return studioCopy.libraryStatus.asset;
  if (item.source === 'collection' || item.status === 'collection') return studioCopy.libraryStatus.collection;
  return studioCopy.libraryStatus.minted;
}

export function openMintedItem(item: MintedItem) {
  if (!item.previewRoute) return;
  window.open(item.previewRoute, '_blank', 'noopener,noreferrer');
}

export function useMintStudioLibrary() {
  const localMintedItems = ref<MintedItem[]>([]);
  const serverMintedItems = ref<MintedItem[]>([]);
  const libraryLoading = ref(false);
  const mintedItems = computed(() => mergeMintedItems([...localMintedItems.value, ...serverMintedItems.value]));

  function loadMintHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(MINT_HISTORY_KEY) || '[]');
      localMintedItems.value = Array.isArray(parsed) ? parsed.slice(0, 30) : [];
    } catch {
      localMintedItems.value = [];
    }
  }

  function saveMintHistory() {
    localStorage.setItem(MINT_HISTORY_KEY, JSON.stringify(localMintedItems.value.slice(0, 30)));
  }

  function rememberMint(input: RememberMintInput) {
    const item: MintedItem = {
      id: input.id,
      rawId: input.id,
      title: input.title,
      appName: input.appName,
      token: input.token,
      previewRoute: input.previewRoute,
      thumb: input.thumb && !input.thumb.startsWith('blob:') ? input.thumb : undefined,
      status: input.status || 'done',
      source: 'local',
      createdAt: new Date().toISOString(),
    };
    localMintedItems.value = [item, ...localMintedItems.value.filter(existing => existing.id !== item.id)].slice(0, 30);
    saveMintHistory();
  }

  function removeMint(item: MintedItem) {
    localMintedItems.value = localMintedItems.value.filter(existing => existing.id !== item.id);
    saveMintHistory();
  }

  async function loadStudioLibrary() {
    if (!isLoggedIn()) {
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

  return {
    libraryLoading,
    mintedItems,
    loadMintHistory,
    loadStudioLibrary,
    rememberMint,
    removeMint,
  };
}
