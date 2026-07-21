<script setup lang="ts">
import { computed, ref } from 'vue';
import { studioCopy } from '../../copy';
import {
  canManageMintedContent,
  mintedStatusText,
  type MintedItem,
} from '../../composables/useMintStudioLibrary';
import type { MintStudioDraftItem } from '../../api';

const props = defineProps<{
  open: boolean;
  items: MintedItem[];
  drafts: MintStudioDraftItem[];
  loading: boolean;
  draftsLoading: boolean;
  activeItemId?: string;
  activeDraftId?: string;
}>();

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
  (event: 'new-mint'): void;
  (event: 'open-item', item: MintedItem): void;
  (event: 'delete-item', item: MintedItem): void;
  (event: 'open-draft', item: MintStudioDraftItem): void;
  (event: 'delete-draft', item: MintStudioDraftItem): void;
}>();

const query = ref('');
const filter = ref<'all' | 'published' | 'draft'>('all');
const listOpen = ref(true);
const draftsOpen = ref(true);

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.items.filter(item => {
    const matchesFilter = filter.value === 'all' || item.status === filter.value;
    const text = `${item.title} ${item.appName} ${item.subtitle || ''}`.toLowerCase();
    return matchesFilter && (!q || text.includes(q));
  });
});

const visibleItems = computed(() => filteredItems.value.slice(0, 24));
const hiddenCount = computed(() => Math.max(0, filteredItems.value.length - visibleItems.value.length));
const visibleDrafts = computed(() => props.drafts.slice(0, 12));

function draftSubtitle(item: MintStudioDraftItem) {
  const name = item.payload?.app?.name || item.appCode || studioCopy.libraryStatus.draft;
  const count = Array.isArray(item.resourceSnapshot) ? item.resourceSnapshot.length : 0;
  return count ? `${name} · ${studioCopy.drafts.restoredResourceCount(count)}` : name;
}
</script>

<template>
  <aside :class="['studio-sidebar', { 'studio-sidebar--collapsed': !open }]">
    <div class="sidebar-actions">
      <button
        type="button"
        class="sidebar-icon"
        :title="open ? studioCopy.sidebar.collapse : studioCopy.sidebar.close"
        @click="emit('update:open', !open)"
      >
        {{ open ? '<' : '>' }}
      </button>
      <button type="button" class="new-mint-button" :title="studioCopy.sidebar.newMintTitle" @click="emit('new-mint')">
        <span>+</span>
        <strong>{{ studioCopy.sidebar.newMint }}</strong>
      </button>
    </div>

    <div class="sidebar-section">
      <button
        type="button"
        class="sidebar-title sidebar-title--button"
        :title="draftsOpen ? studioCopy.sidebar.collapseList : studioCopy.sidebar.expandList"
        @click="draftsOpen = !draftsOpen"
      >
        <span>{{ studioCopy.sidebar.draftsTitle }}</span>
        <b>{{ drafts.length }}</b>
        <i>{{ draftsOpen ? '−' : '+' }}</i>
      </button>
      <p v-if="draftsOpen && draftsLoading && !drafts.length" class="sidebar-empty">{{ studioCopy.sidebar.loading }}</p>
      <div v-if="draftsOpen && visibleDrafts.length" class="minted-list">
        <div
          v-for="draft in visibleDrafts"
          :key="draft.id"
          :class="['minted-item', 'minted-item--draft', { 'minted-item--active': draft.id === activeDraftId }]"
          role="button"
          tabindex="0"
          @click="emit('open-draft', draft)"
          @keydown.enter.prevent="emit('open-draft', draft)"
          @keydown.space.prevent="emit('open-draft', draft)"
        >
          <span class="minted-icon minted-icon--draft">D</span>
          <span class="minted-copy">
            <strong>{{ draft.title }}</strong>
            <small>{{ draftSubtitle(draft) }}</small>
          </span>
          <button
            type="button"
            class="minted-delete"
            :title="studioCopy.drafts.delete"
            @click.stop="emit('delete-draft', draft)"
          >
            ×
          </button>
        </div>
      </div>
      <p v-else-if="draftsOpen && !draftsLoading && !drafts.length" class="sidebar-empty">{{ studioCopy.sidebar.draftsEmpty }}</p>
    </div>

    <div class="sidebar-section">
      <button
        type="button"
        class="sidebar-title sidebar-title--button"
        :title="listOpen ? studioCopy.sidebar.collapseList : studioCopy.sidebar.expandList"
        @click="listOpen = !listOpen"
      >
        <span>{{ studioCopy.sidebar.mintedTitle }}</span>
        <b>{{ items.length }}</b>
        <i>{{ listOpen ? '−' : '+' }}</i>
      </button>
      <div v-if="open && listOpen && items.length" class="library-tools">
        <input v-model="query" :placeholder="studioCopy.sidebar.search" />
        <div class="library-filters">
          <button type="button" :class="{ active: filter === 'all' }" @click="filter = 'all'">{{ studioCopy.sidebar.filterAll }}</button>
          <button type="button" :class="{ active: filter === 'published' }" @click="filter = 'published'">{{ studioCopy.libraryStatus.published }}</button>
          <button type="button" :class="{ active: filter === 'draft' }" @click="filter = 'draft'">{{ studioCopy.libraryStatus.draft }}</button>
        </div>
      </div>
      <p v-if="listOpen && loading && !items.length" class="sidebar-empty">{{ studioCopy.sidebar.loading }}</p>
      <div v-if="listOpen && visibleItems.length" class="minted-list">
        <div
          v-for="item in visibleItems"
          :key="item.id"
          :class="['minted-item', { 'minted-item--active': item.rawId === activeItemId }]"
          role="button"
          tabindex="0"
          @click="emit('open-item', item)"
          @keydown.enter.prevent="emit('open-item', item)"
          @keydown.space.prevent="emit('open-item', item)"
        >
          <span class="minted-icon">
            <img v-if="item.thumb && !item.thumb.startsWith('blob:')" :src="item.thumb" :alt="item.title" />
            <span v-else>{{ item.status === 'collected' ? 'A' : 'M' }}</span>
          </span>
          <span class="minted-copy">
            <strong>{{ item.title }}</strong>
            <small>{{ item.appName }} · {{ mintedStatusText(item) }}</small>
          </span>
          <button
            v-if="canManageMintedContent(item)"
            type="button"
            class="minted-delete"
            :title="studioCopy.actions.deleteContent"
            @click.stop="emit('delete-item', item)"
          >
            ×
          </button>
        </div>
      </div>
      <p v-if="listOpen && hiddenCount && open" class="sidebar-empty">{{ studioCopy.sidebar.moreCount(hiddenCount) }}</p>
      <p v-if="listOpen && !loading && items.length && !visibleItems.length" class="sidebar-empty">{{ studioCopy.sidebar.noResults }}</p>
      <p v-else-if="listOpen && !loading && !items.length" class="sidebar-empty">{{ studioCopy.sidebar.empty }}</p>
    </div>
  </aside>
</template>

<style scoped>
.studio-sidebar {
  position: fixed;
  top: 59px;
  left: 0;
  z-index: 880;
  width: 266px;
  height: calc(100vh - 59px);
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 16px 12px;
  border-right: 1px solid rgba(32, 33, 35, 0.08);
  background: rgba(255, 255, 255, 0.64);
  backdrop-filter: blur(18px);
  box-sizing: border-box;
  box-shadow: 18px 0 48px rgba(32, 33, 35, 0.05);
  transition:
    width 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.sidebar-actions {
  display: grid;
  gap: 9px;
}

.sidebar-icon,
.new-mint-button,
.minted-item {
  border: 1px solid rgba(32, 33, 35, 0.10);
  background: rgba(255, 255, 255, 0.88);
  color: #202123;
  cursor: pointer;
  font: inherit;
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}

.minted-item--active {
  border-color: rgba(47, 111, 94, 0.36);
  background:
    radial-gradient(circle at 100% 0%, rgba(47, 111, 94, 0.12), transparent 48%),
    rgba(255, 255, 255, 0.96);
  box-shadow: inset 0 0 0 1px rgba(47, 111, 94, 0.08);
}

.sidebar-icon {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  font-size: 18px;
  font-weight: 900;
}

.new-mint-button {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 15px;
  text-align: left;
}

.new-mint-button span {
  width: 27px;
  height: 27px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #202123;
  color: #fff;
  font-size: 17px;
  font-weight: 900;
}

.new-mint-button strong {
  font-size: 12.5px;
}

.sidebar-section {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.library-tools {
  display: grid;
  gap: 7px;
  padding: 0 2px 4px;
}

.library-tools input {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--wm-line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--wm-ink);
  font: inherit;
  font-size: 12px;
  outline: none;
}

.library-tools input:focus {
  border-color: var(--wm-accent);
  box-shadow: var(--wm-focus-ring);
}

.library-filters {
  display: flex;
  gap: 5px;
  overflow-x: auto;
}

.library-filters button {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid var(--wm-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--wm-muted);
  cursor: pointer;
  font: inherit;
  font-size: 10.5px;
  font-weight: 800;
}

.library-filters button.active {
  border-color: var(--wm-ink);
  background: var(--wm-ink);
  color: var(--wm-inverse);
}

.sidebar-title {
  margin: 2px 8px;
  color: rgba(32, 33, 35, 0.52);
  font-size: 11px;
  font-weight: 900;
}

.sidebar-title--button {
  width: calc(100% - 16px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 7px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sidebar-title--button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-title--button b,
.sidebar-title--button i {
  display: grid;
  place-items: center;
  font-style: normal;
}

.sidebar-title--button b {
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(32, 33, 35, 0.06);
  color: rgba(32, 33, 35, 0.62);
  font-size: 10px;
}

.sidebar-title--button i {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.74);
  color: rgba(32, 33, 35, 0.64);
  font-size: 13px;
}

.minted-list {
  min-height: 0;
  display: grid;
  gap: 7px;
  overflow-y: auto;
}

.minted-item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 7px;
  border-radius: 15px;
  text-align: left;
}

.minted-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 12px;
  background: #eeeae1;
  color: #7b5b35;
  font-weight: 950;
}

.minted-icon--draft {
  background: rgba(47, 111, 94, 0.12);
  color: #2f6f5e;
}

.minted-item--draft {
  border-style: dashed;
}

.minted-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.minted-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.minted-delete {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid rgba(192, 57, 95, 0.18);
  border-radius: 999px;
  background: rgba(192, 57, 95, 0.06);
  color: #a93457;
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 900;
}

.minted-delete:hover {
  border-color: rgba(192, 57, 95, 0.36);
  background: rgba(192, 57, 95, 0.12);
}

.minted-copy strong,
.minted-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.minted-copy strong {
  font-size: 12.5px;
}

.minted-copy small,
.sidebar-empty {
  color: rgba(32, 33, 35, 0.54);
  font-size: 11px;
}

.sidebar-empty {
  margin: 0 8px;
  line-height: 1.6;
}

.studio-sidebar--collapsed {
  width: 76px;
  align-items: center;
  background: rgba(255, 255, 255, 0.54);
  box-shadow: 12px 0 36px rgba(32, 33, 35, 0.035);
}

.studio-sidebar--collapsed .new-mint-button {
  width: 44px;
  justify-content: center;
  padding: 8px;
}

.studio-sidebar--collapsed .new-mint-button strong,
.studio-sidebar--collapsed .sidebar-title,
.studio-sidebar--collapsed .minted-copy,
.studio-sidebar--collapsed .minted-delete,
.studio-sidebar--collapsed .sidebar-empty {
  display: none;
}

.studio-sidebar--collapsed .minted-item {
  width: 44px;
  justify-content: center;
  padding: 5px;
}

@media (max-width: 760px) {
  .studio-sidebar {
    width: min(320px, 86vw);
    transform: translateX(0);
  }

  .studio-sidebar--collapsed {
    transform: translateX(-104%);
  }
}
</style>
