<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: Array<{ label: string; value: number }>;
  height?: number;
}>();

const chartHeight = computed(() => props.height || 200);
const barWidth = 32;
const gap = 8;
const maxValue = computed(() => Math.max(...props.data.map(d => d.value), 1));
const chartWidth = computed(() => props.data.length * (barWidth + gap));
</script>

<template>
  <div class="bar-chart-wrapper">
    <svg
      :width="Math.max(chartWidth, 300)"
      :height="chartHeight + 40"
      class="bar-chart"
    >
      <!-- Bars -->
      <g v-for="(item, i) in data" :key="i">
        <rect
          :x="i * (barWidth + gap) + gap"
          :y="chartHeight - (item.value / maxValue) * chartHeight"
          :width="barWidth"
          :height="(item.value / maxValue) * chartHeight"
          rx="4"
          class="bar"
        />
        <!-- Value label -->
        <text
          :x="i * (barWidth + gap) + gap + barWidth / 2"
          :y="chartHeight - (item.value / maxValue) * chartHeight - 6"
          class="bar-value"
          text-anchor="middle"
        >{{ item.value }}</text>
        <!-- X-axis label -->
        <text
          :x="i * (barWidth + gap) + gap + barWidth / 2"
          :y="chartHeight + 20"
          class="bar-label"
          text-anchor="middle"
        >{{ item.label }}</text>
      </g>
      <!-- Baseline -->
      <line x1="0" :y1="chartHeight" :x2="chartWidth" :y2="chartHeight" class="baseline" />
    </svg>
  </div>
</template>

<style scoped>
.bar-chart-wrapper {
  overflow-x: auto;
  padding: 8px 0;
}

.bar-chart {
  display: block;
}

.bar {
  fill: var(--accent, #2563eb);
  transition: height 0.3s ease, y 0.3s ease;
}
.bar:hover {
  fill: var(--accent-hover, #1d4ed8);
}

.bar-value {
  font-size: 11px;
  fill: var(--text-secondary, #6b7280);
  font-family: var(--font-sans, sans-serif);
}

.bar-label {
  font-size: 10px;
  fill: var(--text-tertiary, #9ca3af);
  font-family: var(--font-sans, sans-serif);
}

.baseline {
  stroke: var(--border, #e2e8f0);
  stroke-width: 1;
}
</style>
