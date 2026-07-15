<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getWishlist, removeFromWishlist } from '../api';
import NavBar from '../components/NavBar.vue';
import InfiniteScrollTrigger from '../components/InfiniteScrollTrigger.vue';
import { userCopy } from '../copy';

const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const loading = ref(true);
const items = ref<any[]>([]);
const page = ref(1);
const chunkSize = 10;

const visibleItems = computed(() => items.value.slice(0, page.value * chunkSize));
const hasMore = computed(() => visibleItems.value.length < items.value.length);

const loadWishlist = async () => {
  loading.value = true;
  const rows = await getWishlist();
  items.value = Array.isArray(rows) ? rows : [];
  loading.value = false;
};

const handleRemove = async (groupId: string) => {
  await removeFromWishlist(groupId);
  items.value = items.value.filter(item => item.group_id !== groupId);
  toast?.show(userCopy.wishlist.removedToast, 2000, 'success');
};

const goShop = () => {
  router.push('/shop');
};

const handleExternalPurchase = (item: any) => {
  toast?.show(userCopy.wishlist.externalPurchaseToast(item.group_name), 3600, 'success');
};

onMounted(loadWishlist);
</script>

<template>
  <div class="wishlist-page">
    <NavBar />

    <main class="wishlist-shell">
      <div class="wishlist-heading">
        <span class="eyebrow">{{ userCopy.wishlist.eyebrow }}</span>
        <h1>{{ userCopy.wishlist.title }}</h1>
        <p>{{ userCopy.wishlist.intro }}</p>
      </div>

      <div v-if="loading" class="wishlist-loading">
        <div class="spinner"></div>
      </div>

      <template v-else>
        <div v-if="items.length === 0" class="wishlist-empty">
          <div class="empty-mark">♡</div>
          <h2>{{ userCopy.wishlist.emptyTitle }}</h2>
          <p>{{ userCopy.wishlist.emptyBody }}</p>
          <button @click="goShop">{{ userCopy.wishlist.goShop }}</button>
        </div>

        <TransitionGroup v-else name="wish-list" tag="div" class="wishlist-list">
          <article v-for="(item, idx) in visibleItems" :key="item.group_id" class="wish-card" :style="{ '--i': idx }">
            <div class="wish-cover">
              <img v-if="item.video_poster" :src="item.video_poster" alt="" />
              <div v-else class="wish-placeholder">♡</div>
            </div>

            <div class="wish-info">
              <h2>{{ item.group_name }}</h2>
              <p v-if="item.video_title">{{ userCopy.wishlist.defaultContent(item.video_title) }}</p>
              <p v-else>{{ userCopy.wishlist.noDefaultContent }}</p>
            </div>

            <div class="wish-actions">
              <button class="buy-btn" @click="handleExternalPurchase(item)">{{ userCopy.wishlist.externalPurchase }}</button>
              <button class="remove-btn" @click="handleRemove(item.group_id)">{{ userCopy.wishlist.remove }}</button>
            </div>
          </article>
        </TransitionGroup>

        <InfiniteScrollTrigger
          v-if="visibleItems.length > 0"
          :loading="false"
          :has-more="hasMore"
          @load-more="page++"
        />
      </template>
    </main>
  </div>
</template>

<style scoped>
.wishlist-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 86% 8%, rgba(255, 140, 165, 0.26), transparent 30%),
    linear-gradient(180deg, #fff9fb 0%, #f8f1ef 100%);
  color: #25191c;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.wishlist-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 56px;
}

.wishlist-heading {
  margin-bottom: 24px;
}

.eyebrow {
  color: #c45168;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.wishlist-heading h1 {
  margin: 8px 0;
  font-size: clamp(30px, 5vw, 42px);
  font-weight: 950;
  letter-spacing: -0.05em;
}

.wishlist-heading p {
  max-width: 520px;
  margin: 0;
  color: #7b6870;
  font-size: 14px;
  line-height: 1.7;
}

.wishlist-loading {
  display: flex;
  justify-content: center;
  padding: 64px;
}

.spinner {
  width: 26px;
  height: 26px;
  border: 2px solid rgba(37, 25, 28, 0.12);
  border-top-color: #c45168;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.wishlist-empty,
.wish-card {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(196, 81, 104, 0.12);
  border-radius: 24px;
  box-shadow: 0 18px 45px rgba(119, 55, 67, 0.08);
}

.wishlist-empty {
  padding: 44px 24px;
  text-align: center;
}

.empty-mark {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  border-radius: 22px;
  background: #fff1f4;
  color: #c45168;
  font-size: 34px;
}

.wishlist-empty h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.wishlist-empty p {
  margin: 0 0 18px;
  color: #8c7880;
  font-size: 14px;
}

.wishlist-empty button,
.buy-btn,
.remove-btn {
  border: none;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.wishlist-empty button,
.buy-btn {
  padding: 11px 18px;
  background: #25191c;
  color: #fff;
}

.wishlist-list {
  display: grid;
  gap: 12px;
}

.wish-card {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
}

.wish-cover {
  width: 58px;
  height: 76px;
  overflow: hidden;
  border-radius: 14px;
  background: #f7edf0;
}

.wish-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wish-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #c45168;
  font-size: 24px;
}

.wish-info {
  min-width: 0;
}

.wish-info h2 {
  margin: 0 0 5px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wish-info p {
  margin: 0;
  color: #8c7880;
  font-size: 12px;
}

.wish-actions {
  display: flex;
  gap: 8px;
}

.remove-btn {
  padding: 11px 14px;
  border: 1px solid #f0dbe0;
  background: #fff;
  color: #c45168;
}

.wish-list-enter-active {
  transition: all 0.36s ease;
  transition-delay: calc(var(--i) * 45ms);
}

.wish-list-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

@media (max-width: 640px) {
  .wishlist-shell {
    padding: 24px 16px 44px;
  }

  .wish-card {
    grid-template-columns: 52px minmax(0, 1fr);
  }

  .wish-actions {
    grid-column: 1 / -1;
  }

  .wish-actions button {
    flex: 1;
  }
}
</style>
