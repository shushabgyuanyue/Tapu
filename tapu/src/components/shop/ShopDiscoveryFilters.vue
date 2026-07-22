<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  applicationOptions: Array<{ value: string; label: string }>;
  tagOptions: string[];
  selectedApplication: string;
  selectedTag: string;
  searchQuery: string;
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
}>();

defineEmits<{
  'update:selectedApplication': [value: string];
  'update:selectedTag': [value: string];
  'update:searchQuery': [value: string];
  clear: [];
}>();
</script>

<template>
  <section class="shop-discovery-filters wm-panel" :aria-label="shopCopy.filters.ariaLabel">
    <div class="filter-heading">
      <div>
        <span>{{ shopCopy.filters.eyebrow }}</span>
        <strong>{{ shopCopy.filters.title }}</strong>
      </div>
      <small>{{ shopCopy.filters.resultCount(resultCount, totalCount) }}</small>
    </div>

    <label class="search-field">
      <span>{{ shopCopy.filters.searchLabel }}</span>
      <input
        class="wm-input"
        :value="searchQuery"
        type="search"
        :placeholder="shopCopy.filters.searchPlaceholder"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </label>

    <div v-if="applicationOptions.length > 0" class="filter-row">
      <span class="row-label">{{ shopCopy.filters.application }}</span>
      <div class="filter-chips">
        <button
          class="filter-chip wm-chip"
          :class="{ active: !selectedApplication }"
          @click="$emit('update:selectedApplication', '')"
        >
          {{ shopCopy.filters.allApplications }}
        </button>
        <button
          v-for="option in applicationOptions"
          :key="option.value"
          class="filter-chip wm-chip"
          :class="{ active: selectedApplication === option.value }"
          @click="$emit('update:selectedApplication', option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="tagOptions.length > 0" class="filter-row">
      <span class="row-label">{{ shopCopy.filters.tag }}</span>
      <div class="filter-chips">
        <button
          class="filter-chip wm-chip"
          :class="{ active: !selectedTag }"
          @click="$emit('update:selectedTag', '')"
        >
          {{ shopCopy.filters.allTags }}
        </button>
        <button
          v-for="tag in tagOptions"
          :key="tag"
          class="filter-chip wm-chip"
          :class="{ active: selectedTag === tag }"
          @click="$emit('update:selectedTag', tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <div class="filter-actions">
      <button v-if="hasActiveFilters" class="clear-action wm-btn-ghost" @click="$emit('clear')">
        {{ shopCopy.filters.clear }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.shop-discovery-filters {
  display: grid;
  gap: 14px;
  margin: 0 0 18px;
  padding: 18px;
  border-radius: 30px;
  background:
    radial-gradient(circle at 4% 0%, rgba(47, 111, 94, 0.10), transparent 26%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 250, 244, 0.88));
}

.filter-heading,
.filter-actions,
.filter-row,
.filter-chips {
  display: flex;
  align-items: center;
}

.filter-heading {
  justify-content: space-between;
  gap: 16px;
}

.filter-heading div {
  display: grid;
  gap: 3px;
}

.filter-heading span,
.row-label,
.search-field span {
  color: var(--wm-accent);
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.filter-heading strong {
  color: var(--wm-ink);
  font-size: 18px;
}

.filter-heading small {
  color: var(--wm-muted);
  font-size: 12px;
  font-weight: 850;
}

.search-field {
  display: grid;
  gap: 8px;
}

.search-field input {
  border-radius: 18px;
}

.filter-row {
  gap: 12px;
}

.row-label {
  flex: 0 0 62px;
}

.filter-chips,
.filter-actions {
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip,
.clear-action {
  min-height: 34px;
  font-size: 12px;
  cursor: pointer;
}

.filter-chip {
  border: 1px solid var(--wm-line);
  color: var(--wm-muted);
  background: rgba(255, 255, 255, 0.74);
}

.filter-chip.active {
  border-color: transparent;
  color: var(--wm-inverse);
  background: linear-gradient(135deg, var(--wm-ink), var(--wm-accent));
  box-shadow: var(--wm-shadow-glow);
}

.clear-action {
  margin-left: auto;
}

@media (max-width: 640px) {
  .shop-discovery-filters {
    padding: 15px;
    border-radius: 24px;
  }

  .filter-heading,
  .filter-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .row-label {
    flex: none;
  }

  .clear-action {
    margin-left: 0;
  }
}
</style>
