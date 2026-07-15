<script setup lang="ts">
import { commonCopy } from '../copy';

defineProps<{
  seriesList: any[];
  groupList: any[];
  activeSeries: string;
  activeGroup: string;
}>();

const emit = defineEmits<{
  'update:activeSeries': [id: string];
  'update:activeGroup': [id: string];
}>();
</script>

<template>
  <div class="sgf">
    <div class="sgf-row">
      <button
        class="sgf-chip sgf-chip--series"
        :class="{ active: activeSeries === '' }"
        @click="emit('update:activeSeries', ''); emit('update:activeGroup', '')"
      >{{ commonCopy.filters.allSeries }}</button>
      <button
        v-for="s in seriesList"
        :key="s.id"
        class="sgf-chip sgf-chip--series"
        :class="{ active: activeSeries === s.id }"
        @click="emit('update:activeSeries', s.id); emit('update:activeGroup', '')"
      >{{ s.name }}</button>
    </div>
    <div class="sgf-row" v-if="groupList.length > 0">
      <button
        class="sgf-chip"
        :class="{ active: activeGroup === '' }"
        @click="emit('update:activeGroup', '')"
      >{{ commonCopy.filters.allIp }}</button>
      <button
        v-for="g in groupList"
        :key="g.id"
        class="sgf-chip"
        :class="{ active: activeGroup === g.id }"
        @click="emit('update:activeGroup', g.id)"
      >{{ g.name }}</button>
    </div>
  </div>
</template>

<style scoped>
.sgf-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.sgf-chip {
  padding: 7px 18px; border-radius: 99px;
  font-size: 13px; border: 1px solid #eee; background: #fff;
  color: #666; cursor: pointer; transition: all 0.15s;
}
.sgf-chip:hover { border-color: #ddd; color: #333; }
.sgf-chip.active { background: #7c4dff; color: #fff; border-color: #7c4dff; }
.sgf-chip--series.active { background: #1a1a1a; border-color: #1a1a1a; }
</style>
