<script setup lang="ts">
defineProps<{
  group: any;
  image: string;
  tags: string[];
  statusText: string;
  priceText: string;
  progress: number;
  wishlistEnabled: boolean;
  inWishlist: boolean;
  wishlistCount: number;
}>();

defineEmits<{
  openDetail: [group: any];
  externalPurchase: [group: any];
  pledge: [group: any];
  addWishlist: [group: any];
}>();
</script>

<template>
  <article class="shop-card">
    <button class="product-stage" @click="$emit('openDetail', group)">
      <span class="status-tag" :class="group.sale_status">{{ statusText }}</span>
      <img :src="image" :alt="group.name" />
    </button>

    <div class="card-body">
      <div class="card-title-row">
        <div>
          <span class="series-name">{{ group.series_name || group.application_name || 'WhatMint' }}</span>
          <h2>{{ group.name }}</h2>
        </div>
        <strong>{{ priceText }}</strong>
      </div>

      <p>{{ group.description || '触碰实体即可进入它绑定的小世界，内容可以被更新，也可以成为长期存在的关系载体。' }}</p>

      <div class="tag-list">
        <span v-for="tag in tags" :key="tag">{{ tag }}</span>
      </div>

      <div class="progress-row" v-if="group.stock_limit > 0 || group.crowdfund_goal > 0">
        <div class="progress-track">
          <div class="progress-fill" :class="{ crowd: group.sale_status === 'crowdfunding' }" :style="{ width: progress + '%' }"></div>
        </div>
        <span v-if="group.stock_limit > 0">已发放 {{ group.entity_count || 0 }} / {{ group.stock_limit }}</span>
        <span v-else>众筹 {{ group.pledge_count || 0 }} / {{ group.crowdfund_goal }}</span>
      </div>

      <div class="shop-actions">
        <button class="primary-action" @click="$emit('openDetail', group)">查看档案</button>
        <button v-if="group.sale_status === 'purchasable'" class="secondary-action" @click="$emit('externalPurchase', group)">外部购买</button>
        <button v-else-if="group.sale_status === 'crowdfunding'" class="secondary-action" @click="$emit('pledge', group)">参与众筹</button>
        <button v-else class="secondary-action" disabled>{{ group.sale_status === 'sold_out' ? '已售罄' : '暂不可购买' }}</button>
      </div>

      <button
        v-if="wishlistEnabled"
        class="wish-action"
        :class="{ active: inWishlist }"
        @click="$emit('addWishlist', group)"
      >
        <span>{{ inWishlist ? '已在心愿单' : '加入心愿单' }}</span>
        <strong>{{ wishlistCount || 0 }}</strong>
      </button>
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

.status-tag.purchasable,
.status-tag.crowdfund_success {
  background: rgba(38, 204, 118, 0.22);
  color: #dfffea;
}

.status-tag.crowdfunding {
  background: rgba(255, 184, 107, 0.22);
  color: #ffe6c4;
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

.card-title-row strong {
  color: #15131f;
  font-size: 17px;
  white-space: nowrap;
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

.progress-row {
  display: grid;
  gap: 6px;
  color: #887a90;
  font-size: 12px;
  font-weight: 800;
}

.progress-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #f0e7f2;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ff4fd8, #7c4dff);
}

.progress-fill.crowd {
  background: linear-gradient(90deg, #ffb86b, #ff4fd8);
}

.shop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.primary-action,
.secondary-action,
.wish-action {
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

.secondary-action,
.wish-action {
  border: 1px solid #eee5f2;
  color: #34203c;
  background: rgba(255, 255, 255, 0.82);
}

.secondary-action:disabled {
  color: #aaa0af;
  background: #f4eff5;
  cursor: not-allowed;
}

.wish-action {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  color: #c45193;
}

.wish-action.active {
  border-color: #ffd0ef;
  background: #fff4fb;
}

.wish-action strong {
  min-width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 79, 216, 0.12);
  font-size: 11px;
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
