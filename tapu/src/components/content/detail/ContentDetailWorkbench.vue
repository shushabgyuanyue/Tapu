<script setup lang="ts">
defineProps<{
  title: string;
  kicker: string;
  summary: string;
  previewCover: string;
  previewAlt: string;
  modeLabel?: string;
  statusLabel?: string;
  contentIdLabel: string;
  resourceLabel: string;
  resourceNames: string[];
  noCoverLabel: string;
  previewLabel: string;
  copyIdLabel: string;
}>();

defineEmits<{
  (event: 'preview'): void;
  (event: 'copy-id'): void;
}>();
</script>

<template>
  <section class="detail-workbench">
    <aside class="detail-preview-zone">
      <button
        type="button"
        class="preview-cover"
        @click="$emit('preview')"
      >
        <img v-if="previewCover" :src="previewCover" :alt="previewAlt" />
        <span v-else class="preview-cover-empty">{{ noCoverLabel }}</span>
        <strong>{{ previewLabel }}</strong>
      </button>

      <slot name="resource-visual"></slot>
    </aside>

    <section class="detail-control-zone">
      <header class="detail-identity">
        <p class="hero-kicker">{{ kicker }}</p>
        <h1>{{ title }}</h1>
        <p v-if="summary" class="hero-summary">{{ summary }}</p>
      </header>

      <div class="maintenance-meta">
        <span v-if="modeLabel">{{ modeLabel }}</span>
        <span v-if="statusLabel">{{ statusLabel }}</span>
        <button class="copy-id-chip" type="button" @click="$emit('copy-id')">
          <span>{{ copyIdLabel }}</span>
          <small>{{ contentIdLabel }}</small>
        </button>
      </div>

      <div v-if="resourceNames.length" class="resource-mini">
        <span>{{ resourceLabel }}</span>
        <strong>{{ resourceNames[0] }}</strong>
      </div>

      <slot name="actions"></slot>
    </section>
  </section>

  <slot name="structure"></slot>
</template>
