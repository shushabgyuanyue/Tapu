<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  change: [from: string, to: string];
}>();

const fromDate = ref('');
const toDate = ref('');

const apply = () => { emit('change', fromDate.value, toDate.value); };

const setPreset = (days: number) => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  fromDate.value = from.toISOString().split('T')[0];
  toDate.value = to.toISOString().split('T')[0];
  apply();
};

const clear = () => {
  fromDate.value = '';
  toDate.value = '';
  emit('change', '', '');
};
</script>

<template>
  <div class="drp">
    <button @click="setPreset(7)" class="chip">近7天</button>
    <button @click="setPreset(30)" class="chip">近30天</button>
    <button @click="clear" class="chip chip-dim">全部</button>
    <input type="date" v-model="fromDate" class="date-inp" @change="apply" />
    <span class="sep">-</span>
    <input type="date" v-model="toDate" class="date-inp" @change="apply" />
  </div>
</template>

<style scoped>
.drp { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.chip {
  padding: 4px 9px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-card);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s;
}
.chip:hover { background: var(--bg-hover); color: var(--text-primary); }
.chip-dim { color: var(--text-muted); }

.date-inp {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  background: var(--bg-card);
  color: var(--text-secondary);
  outline: none;
}

.sep { font-size: 11px; color: var(--text-muted); }
</style>
