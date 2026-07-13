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
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(255, 247, 252, 0.94));
  box-shadow: 0 18px 46px rgba(45, 18, 60, 0.11);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.shop-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 26px 64px rgba(88, 35, 105, 0.17);
}

.product-stage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 218px;
  border: 0;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.44), transparent 28%),
    linear-gradient(145deg, #21102a, #0c0611);
  cursor: pointer;
}

.product-stage img {
  width: min(66%, 210px);
  max-height: 205px;
  object-fit: contain;
  filter: drop-shadow(0 22px 26px rgba(0, 0, 0, 0.30));
}

.status-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
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
  display: grid;
  gap: 11px;
  padding: 15px;
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
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.card-title-row strong {
  color: #ff4fd8;
  font-size: 16px;
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
  color: #6d4a73;
  background: #f7eff9;
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
  min-height: 38px;
  border-radius: 13px;
  font-size: 12px;
  font-weight: 950;
  cursor: pointer;
}

.primary-action {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
}

.secondary-action,
.wish-action {
  border: 1px solid #eee5f2;
  color: #34203c;
  background: #fff;
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
    border-radius: 22px;
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
