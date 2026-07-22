<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  ip: any;
  heroImage: string;
  tags: string[];
  hasExperience: boolean;
}>();

defineEmits<{
  invite: [];
  experience: [];
  openSpace: [];
}>();
</script>

<template>
  <section class="detail-hero">
    <div class="hero-visual">
      <img :src="heroImage" :alt="ip.name" />
    </div>

    <div class="hero-copy">
      <span class="eyebrow">{{ ip.series_name || shopCopy.detail.fallbackEyebrow }}</span>
      <h1>{{ ip.name }}</h1>
      <p>{{ ip.description || shopCopy.detail.fallbackDescription }}</p>

      <div class="tag-list">
        <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="hero-actions">
        <button class="primary-action" @click="$emit('invite')">{{ shopCopy.detail.invite }}</button>
        <button class="ghost-action" :disabled="!hasExperience" @click="$emit('experience')">
          {{ hasExperience ? shopCopy.detail.experience : shopCopy.detail.experienceEmpty }}
        </button>
        <button class="text-action" @click="$emit('openSpace')">{{ shopCopy.detail.mintSpace }}</button>
      </div>

      <small>{{ shopCopy.detail.inviteHint }}</small>
    </div>
  </section>
</template>

<style scoped>
.detail-hero {
  display: grid;
  grid-template-columns: minmax(280px, 0.88fr) minmax(0, 1.12fr);
  gap: 22px;
  align-items: stretch;
}

.hero-visual,
.hero-copy {
  border: 1px solid rgba(44, 35, 48, 0.10);
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 70px rgba(47, 41, 32, 0.10);
}

.hero-visual {
  min-height: 460px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.48), transparent 28%),
    linear-gradient(150deg, var(--wm-canvas), rgba(47, 111, 94, 0.22) 68%, var(--wm-canvas-warm));
}

.hero-visual img {
  width: min(76%, 360px);
  max-height: 390px;
  object-fit: contain;
  filter: drop-shadow(0 34px 44px rgba(32, 27, 34, 0.18));
}

.hero-copy {
  display: grid;
  align-content: center;
  gap: 18px;
  padding: clamp(26px, 5vw, 52px);
}

.eyebrow {
  color: var(--wm-accent);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(44px, 7vw, 78px);
  line-height: 0.96;
  letter-spacing: -0.08em;
}

.hero-copy p {
  margin: 0;
  color: var(--wm-muted);
  line-height: 1.85;
}

.tag-list,
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.tag-list span {
  padding: 7px 11px;
  border-radius: 999px;
  background: var(--wm-surface-soft);
  color: var(--wm-muted);
  font-size: 12px;
  font-weight: 850;
}

.primary-action,
.ghost-action,
.text-action {
  border: 0;
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 900;
  cursor: pointer;
}

.primary-action {
  border: 1px solid var(--wm-line);
  background: var(--wm-surface-solid);
  color: var(--wm-ink);
}

.ghost-action {
  border: 1px solid var(--wm-line);
  background: var(--wm-surface-solid);
  color: var(--wm-ink);
}

.ghost-action:disabled {
  color: var(--wm-muted);
  cursor: not-allowed;
  opacity: 0.55;
}

.text-action {
  background: transparent;
  color: var(--wm-accent);
}

.hero-copy small {
  color: var(--wm-muted);
  line-height: 1.7;
}

@media (max-width: 820px) {
  .detail-hero {
    grid-template-columns: 1fr;
  }

  .hero-visual {
    min-height: 320px;
  }

  .hero-copy,
  .hero-visual {
    border-radius: 26px;
  }
}
</style>
