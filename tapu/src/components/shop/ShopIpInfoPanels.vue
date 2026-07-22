<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  ip: any;
  storyParagraphs: string[];
  specRows: Array<{ label: string; value: unknown }>;
}>();
</script>

<template>
  <section class="panel-grid">
    <article class="info-panel story-panel">
      <span class="panel-kicker">{{ shopCopy.detail.storyTitle }}</span>
      <p v-for="paragraph in storyParagraphs" :key="paragraph">{{ paragraph }}</p>
    </article>

    <article class="info-panel app-panel">
      <span class="panel-kicker">{{ shopCopy.detail.appTitle }}</span>
      <h2>{{ ip.application_name || shopCopy.card.defaultApp }}</h2>
      <p>{{ ip.application_description || shopCopy.detail.appFallback }}</p>
    </article>

    <article v-if="specRows.length" class="info-panel spec-panel">
      <span class="panel-kicker">{{ shopCopy.detail.specTitle }}</span>
      <dl>
        <template v-for="row in specRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
    </article>
  </section>
</template>

<style scoped>
.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.info-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 24px;
  border: 1px solid rgba(44, 35, 48, 0.10);
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 70px rgba(47, 41, 32, 0.10);
}

.panel-kicker {
  color: var(--wm-accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.info-panel h2 {
  margin: 0;
  font-size: 26px;
  letter-spacing: -0.05em;
}

.info-panel p {
  margin: 0;
  color: var(--wm-muted);
  line-height: 1.85;
}

.story-panel {
  min-height: 260px;
}

.spec-panel dl {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 10px 16px;
  margin: 0;
}

.spec-panel dt {
  color: var(--wm-muted);
  font-size: 12px;
  font-weight: 900;
}

.spec-panel dd {
  margin: 0;
  color: var(--wm-ink);
}

@media (max-width: 820px) {
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .info-panel {
    border-radius: 26px;
  }
}
</style>
