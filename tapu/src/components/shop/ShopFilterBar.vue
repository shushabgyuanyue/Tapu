<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  seriesList: any[];
  groups: any[];
  activeSeries: string;
  activeGroup: string;
}>();

defineEmits<{
  switchSeries: [id: string];
  switchGroup: [id: string];
}>();
</script>

<template>
  <section class="filter-panel" v-if="seriesList.length || groups.length">
    <div class="filter-row" v-if="seriesList.length > 0">
      <button class="filter-chip" :class="{ active: activeSeries === '' }" @click="$emit('switchSeries', '')">{{ shopCopy.filters.allSeries }}</button>
      <button
        v-for="series in seriesList"
        :key="series.id"
        class="filter-chip"
        :class="{ active: activeSeries === series.id }"
        @click="$emit('switchSeries', series.id)"
      >
        {{ series.name }}
      </button>
    </div>

    <div class="filter-row filter-row--soft" v-if="groups.length > 0">
      <button class="filter-chip soft" :class="{ active: activeGroup === '' }" @click="$emit('switchGroup', '')">{{ shopCopy.filters.allIp }}</button>
      <button
        v-for="group in groups"
        :key="group.id"
        class="filter-chip soft"
        :class="{ active: activeGroup === group.id }"
        @click="$emit('switchGroup', group.id)"
      >
        {{ group.name }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.filter-panel {
  display: grid;
  gap: 10px;
  margin: 0 0 18px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 46px rgba(45, 18, 60, 0.10);
  backdrop-filter: blur(18px);
}

.filter-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.filter-row::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  flex: 0 0 auto;
  padding: 8px 14px;
  border: 1px solid rgba(124, 77, 255, 0.14);
  border-radius: 999px;
  background: #fff;
  color: #6d6174;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.filter-chip.active {
  border-color: #1c1124;
  background: #1c1124;
  color: #fff;
}

.filter-chip.soft.active {
  border-color: #ff4fd8;
  background: #fff0fb;
  color: #c7269d;
}

@media (max-width: 640px) {
  .filter-panel {
    position: sticky;
    top: 58px;
    z-index: 5;
    margin-inline: -4px;
    border-radius: 18px;
  }

  .filter-chip {
    padding: 8px 12px;
    font-size: 12px;
  }
}
</style>
