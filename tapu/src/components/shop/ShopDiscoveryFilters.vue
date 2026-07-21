<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  applicationOptions: Array<{ value: string; label: string }>;
  tagOptions: string[];
  selectedApplication: string;
  selectedTag: string;
  searchQuery: string;
  experienceOnly: boolean;
  invitationOnly: boolean;
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
}>();

defineEmits<{
  'update:selectedApplication': [value: string];
  'update:selectedTag': [value: string];
  'update:searchQuery': [value: string];
  'update:experienceOnly': [value: boolean];
  'update:invitationOnly': [value: boolean];
  clear: [];
}>();
</script>

<template>
  <section class="shop-discovery-filters" :aria-label="shopCopy.filters.ariaLabel">
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
          class="filter-chip"
          :class="{ active: !selectedApplication }"
          @click="$emit('update:selectedApplication', '')"
        >
          {{ shopCopy.filters.allApplications }}
        </button>
        <button
          v-for="option in applicationOptions"
          :key="option.value"
          class="filter-chip"
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
          class="filter-chip"
          :class="{ active: !selectedTag }"
          @click="$emit('update:selectedTag', '')"
        >
          {{ shopCopy.filters.allTags }}
        </button>
        <button
          v-for="tag in tagOptions"
          :key="tag"
          class="filter-chip"
          :class="{ active: selectedTag === tag }"
          @click="$emit('update:selectedTag', tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <div class="filter-actions">
      <button
        class="signal-chip"
        :class="{ active: experienceOnly }"
        @click="$emit('update:experienceOnly', !experienceOnly)"
      >
        {{ shopCopy.filters.withExperience }}
      </button>
      <button
        class="signal-chip"
        :class="{ active: invitationOnly }"
        @click="$emit('update:invitationOnly', !invitationOnly)"
      >
        {{ shopCopy.filters.withInvitation }}
      </button>
      <button v-if="hasActiveFilters" class="clear-action" @click="$emit('clear')">
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
  border: 1px solid rgba(55, 28, 66, 0.10);
  border-radius: 30px;
  background:
    radial-gradient(circle at 4% 0%, rgba(255, 79, 216, 0.14), transparent 26%),
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 249, 253, 0.88));
  box-shadow: 0 18px 46px rgba(55, 26, 70, 0.08);
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
  color: #a2388d;
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.filter-heading strong {
  color: #211129;
  font-size: 18px;
}

.filter-heading small {
  color: #817086;
  font-size: 12px;
  font-weight: 850;
}

.search-field {
  display: grid;
  gap: 8px;
}

.search-field input {
  width: 100%;
  min-height: 44px;
  padding: 0 15px;
  border: 1px solid #efe3f2;
  border-radius: 18px;
  color: #25152c;
  background: rgba(255, 255, 255, 0.78);
  font: inherit;
  outline: none;
}

.search-field input:focus {
  border-color: rgba(255, 79, 216, 0.42);
  box-shadow: 0 0 0 4px rgba(255, 79, 216, 0.08);
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
.signal-chip,
.clear-action {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.filter-chip,
.signal-chip {
  border: 1px solid #efe2f2;
  color: #604668;
  background: rgba(255, 255, 255, 0.74);
}

.filter-chip.active,
.signal-chip.active {
  border-color: transparent;
  color: #fff;
  background: linear-gradient(135deg, #201029, #7c4dff 58%, #ff4fd8);
  box-shadow: 0 10px 22px rgba(124, 77, 255, 0.16);
}

.clear-action {
  margin-left: auto;
  border: 0;
  color: #9b3b84;
  background: rgba(255, 79, 216, 0.10);
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
