<script setup lang="ts">
import { computed } from 'vue';
import type { MintSpaceProfile } from '../../api/assets';
import { userCopy } from '../../copy';

const props = defineProps<{
  notes: MintSpaceProfile['notes'];
}>();

const visibleNotes = computed(() => props.notes.length > 0 ? props.notes : userCopy.assets.mintSpace.emptyNotes);
</script>

<template>
  <section class="mint-space-panel">
    <div class="mint-space-section-head">
      <span class="asset-eyebrow asset-eyebrow--dark">{{ userCopy.assets.mintSpace.notesEyebrow }}</span>
      <h2>{{ userCopy.assets.mintSpace.notesTitle }}</h2>
    </div>

    <div class="mint-space-notes">
      <article v-for="note in visibleNotes" :key="note.id" class="mint-space-note-card">
        <p>{{ note.text }}</p>
      </article>
    </div>
  </section>
</template>
