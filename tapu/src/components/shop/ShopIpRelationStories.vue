<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  relations: any[];
}>();
</script>

<template>
  <section class="relation-section">
    <div class="section-head">
      <span class="panel-kicker">{{ shopCopy.detail.relationsTitle }}</span>
      <p>{{ shopCopy.detail.relationsIntro }}</p>
    </div>

    <div v-if="relations.length" class="relation-list">
      <article v-for="relation in relations" :key="relation.id" class="relation-card">
        <strong>{{ relation.counterpart_ip_definition_name }}</strong>
        <span>{{ relation.display_relation_label || relation.relation_label || relation.relation_type }}</span>
        <p>{{ relation.narrative }}</p>
      </article>
    </div>
    <p v-else class="empty-note">{{ shopCopy.detail.relationsEmpty }}</p>
  </section>
</template>

<style scoped>
.relation-section {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid rgba(44, 35, 48, 0.10);
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 70px rgba(47, 41, 32, 0.10);
}

.section-head {
  display: grid;
  gap: 8px;
  max-width: 720px;
}

.panel-kicker {
  color: var(--wm-accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.section-head p,
.empty-note {
  margin: 0;
  color: var(--wm-muted);
  line-height: 1.85;
}

.relation-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.relation-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--wm-line);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.68);
}

.relation-card strong {
  font-size: 17px;
}

.relation-card span {
  color: var(--wm-accent);
  font-size: 12px;
  font-weight: 950;
}

.relation-card p {
  margin: 0;
  color: var(--wm-muted);
  line-height: 1.75;
}

.empty-note {
  margin-top: 16px;
}

@media (max-width: 820px) {
  .relation-section {
    border-radius: 26px;
  }

  .relation-list {
    grid-template-columns: 1fr;
  }
}
</style>
