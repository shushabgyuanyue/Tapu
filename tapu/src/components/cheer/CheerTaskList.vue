<script setup lang="ts">
import type { CheerTask } from '../../composables/useCheerNote';

defineProps<{
  tasks: CheerTask[];
  holdTaskId: number | null;
  holdProgress: number;
  burstingTaskId: number | null;
}>();

defineEmits<{
  startHold: [task: CheerTask];
  endHold: [];
  complete: [task: CheerTask];
}>();

function shouldStartHold(event: PointerEvent) {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}
</script>

<template>
  <div class="cheer-task-list">
    <article
      v-for="task in tasks"
      :key="task.id"
      class="cheer-task"
      :class="[
        `cheer-task--${task.state}`,
        {
          'cheer-task--holding': holdTaskId === task.id,
          'cheer-task--bursting': burstingTaskId === task.id,
        },
      ]"
      :style="holdTaskId === task.id ? { '--cheer-hold': holdProgress } : undefined"
      @pointerdown="shouldStartHold($event) && $emit('startHold', task)"
      @pointerup="$emit('endHold')"
      @pointerleave="$emit('endHold')"
      @pointercancel="$emit('endHold')"
      @dblclick="$emit('complete', task)"
    >
      <p>{{ task.text }}</p>
      <span class="cheer-task__progress"></span>
    </article>
  </div>
</template>
