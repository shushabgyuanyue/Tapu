<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
}>(), {
  pageSize: 10,
  pageSizeOptions: () => [10, 20, 50],
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'update:pageSize', value: number): void;
}>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

const paginationNumbers = computed(() => {
  const total = totalPages.value;
  const current = props.modelValue;
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  return Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
});

const setPage = (page: number) => {
  emit('update:modelValue', Math.min(Math.max(1, page), totalPages.value));
};

const onPageSizeChange = (event: Event) => {
  const next = Number((event.target as HTMLSelectElement).value) || 10;
  emit('update:pageSize', next);
  emit('update:modelValue', 1);
};
</script>

<template>
  <div class="pager-wrap">
    <div class="pager-meta">
      <span class="pager-total">共 {{ total }} 条</span>
      <label class="pager-size">
        每页
        <select :value="pageSize" @change="onPageSizeChange">
          <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
        </select>
        条
      </label>
    </div>

    <div class="pager">
      <button class="pager-btn" :disabled="modelValue <= 1" @click="setPage(modelValue - 1)">上一页</button>
      <div class="pager-pages">
        <button
          v-for="p in paginationNumbers"
          :key="p"
          class="pager-page"
          :class="{ active: p === modelValue }"
          @click="setPage(p)"
        >{{ p }}</button>
      </div>
      <span class="pager-num">第 {{ modelValue }} / {{ totalPages }} 页</span>
      <button class="pager-btn" :disabled="modelValue >= totalPages" @click="setPage(modelValue + 1)">下一页</button>
    </div>
  </div>
</template>

<style scoped>
.pager-wrap { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.pager-meta { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--text-muted); font-size: 12px; }
.pager-size { display: inline-flex; align-items: center; gap: 6px; }
.pager-size select {
  padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: #fff; color: #666;
}
.pager { display: flex; align-items: center; justify-content: center; gap: 12px; }
.pager-num { font-size: 12px; color: var(--text-muted); }
.pager-pages { display: flex; align-items: center; gap: 6px; }
.pager-btn, .pager-page {
  min-width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: #fff; color: #666; cursor: pointer;
}
.pager-btn { padding: 0 12px; }
.pager-btn:disabled, .pager-page:disabled { opacity: 0.45; cursor: default; }
.pager-page.active { background: var(--accent); color: #fff; border-color: var(--accent); }
@media (max-width: 640px) {
  .pager-meta, .pager { flex-wrap: wrap; justify-content: center; }
}
</style>