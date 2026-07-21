<script setup lang="ts">
import { shopCopy } from '../../copy';

defineProps<{
  ip: any;
  image: string;
  tags: string[];
}>();

defineEmits<{
  openDetail: [ip: any];
  externalPurchase: [ip: any];
}>();
</script>

<template>
  <article class="shop-card">
    <button class="product-stage" @click="$emit('openDetail', ip)">
      <span class="status-tag">{{ ip.application_name || shopCopy.card.defaultApp }}</span>
      <img :src="image" :alt="ip.name" />
    </button>

    <div class="card-body">
      <div class="card-title-row">
        <div>
          <span class="series-name">{{ ip.series_name || ip.application_name || 'WhatMint' }}</span>
          <h2>{{ ip.name }}</h2>
        </div>
      </div>

      <p>{{ ip.description || shopCopy.card.fallbackDescription }}</p>

      <div class="tag-list">
        <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="shop-actions">
        <button class="primary-action" @click="$emit('openDetail', ip)">{{ shopCopy.card.detail }}</button>
        <button class="secondary-action" @click="$emit('externalPurchase', ip)">{{ shopCopy.card.externalPurchase }}</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.shop-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(42, 20, 52, 0.08);
  border-radius: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 252, 0.96));
  box-shadow: 0 18px 50px rgba(42, 18, 55, 0.10);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.shop-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 79, 216, 0.12), transparent 34%, rgba(124, 77, 255, 0.10));
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.shop-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 28px 72px rgba(76, 30, 100, 0.18);
}

.shop-card:hover::before {
  opacity: 1;
}

.product-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 236px;
  border: 0;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 34px),
    linear-gradient(0deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 34px),
    radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.22), transparent 30%),
    radial-gradient(circle at 18% 88%, rgba(255, 79, 216, 0.18), transparent 36%),
    linear-gradient(145deg, #25112e, #0a0610);
  cursor: pointer;
}

.product-stage::after {
  content: "";
  position: absolute;
  inset: auto 20px 18px;
  height: 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.24);
  filter: blur(10px);
}

.product-stage img {
  position: relative;
  z-index: 1;
  width: min(62%, 214px);
  max-height: 210px;
  object-fit: contain;
  filter: drop-shadow(0 24px 30px rgba(0, 0, 0, 0.34));
  transition: transform 0.2s ease;
}

.shop-card:hover .product-stage img {
  transform: translateY(-5px) rotate(-1deg) scale(1.03);
}

.status-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  backdrop-filter: blur(14px);
  background: rgba(255, 255, 255, 0.15);
  font-size: 11px;
  font-weight: 950;
}

.card-body {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  padding: 17px;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.series-name {
  color: #a2388d;
  font-size: 11px;
  font-weight: 900;
}

.card-title-row h2 {
  margin: 4px 0 0;
  font-size: 19px;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.card-body p {
  display: -webkit-box;
  min-height: 44px;
  margin: 0;
  overflow: hidden;
  color: #736779;
  font-size: 12px;
  line-height: 1.65;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-list span {
  padding: 5px 8px;
  border-radius: 999px;
  color: #5f4668;
  background: #f8eff8;
  font-size: 11px;
  font-weight: 900;
}

.shop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.primary-action,
.secondary-action {
  min-height: 40px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 950;
  cursor: pointer;
}

.primary-action {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #17101f, #7c4dff 54%, #ff4fd8);
  box-shadow: 0 12px 22px rgba(124, 77, 255, 0.20);
}

.secondary-action {
  border: 1px solid #eee5f2;
  color: #34203c;
  background: rgba(255, 255, 255, 0.82);
}

@media (max-width: 640px) {
  .shop-card {
    border-radius: 24px;
  }

  .product-stage {
    min-height: 176px;
  }

  .product-stage img {
    width: min(58%, 150px);
    max-height: 150px;
  }

  .card-body {
    padding: 14px;
  }
}
</style>
