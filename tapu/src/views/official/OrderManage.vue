<script setup lang="ts">
import { ref, onMounted, inject, watch } from 'vue';
import { fetchOrders, updateOrderStatus } from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const orders = ref<any[]>([]);
const loading = ref(true);
const pagination = useServerPagination();
const { page, pageSize, total: totalOrders, resetPage, applyPagedResult } = pagination;

const loadOrders = async () => {
  loading.value = true;
  const result = await fetchOrders({ page: page.value, pageSize: pageSize.value });
  applyPagedResult(result, orders);
  loading.value = false;
};

onMounted(loadOrders);
watch(page, () => { loadOrders(); });
watch(pageSize, () => {
  resetPage();
  loadOrders();
});

const statusLabel = (s: string) => {
  if (s === 'shipped') return '已发货';
  if (s === 'completed') return '已完成';
  return '待发货';
};

const markStatus = async (orderId: string, status: string) => {
  const data = await updateOrderStatus(orderId, status);
  if (data.success) {
    const order = orders.value.find(o => o.id === orderId);
    if (order) order.status = status;
    toast?.show('状态已更新', 2000, 'success');
  } else {
    toast?.show(data.error || '更新失败', 2500, 'error');
  }
};

const copyKey = (key: string) => {
  navigator.clipboard.writeText(key);
  toast?.show('密钥已复制');
};

const getEntityUrl = (key: string) => {
  return `${window.location.origin}/play?key=${encodeURIComponent(key)}`;
};

const copyUrl = (key: string) => {
  navigator.clipboard.writeText(getEntityUrl(key));
  toast?.show('访问链接已复制');
};
</script>

<template>
  <div class="order-manage">
    <h2 class="om-title">订单管理</h2>
    <div v-if="loading" class="om-loading">加载中...</div>
    <div v-else-if="orders.length === 0" class="om-empty">暂无订单</div>
    <div v-else class="om-list">
      <div v-for="o in orders" :key="o.id" class="om-card">
        <div class="om-row om-row--header">
          <span class="om-ip">{{ o.group_name || 'IP' }}</span>
          <span class="om-status" :class="'om-status--' + o.status">{{ statusLabel(o.status) }}</span>
        </div>
        <div class="om-row">
          <span class="om-label">买家</span>
          <span>{{ o.buyer_username }}</span>
        </div>
        <div class="om-row">
          <span class="om-label">收件人</span>
          <span>{{ o.recipient_name }} / {{ o.phone }}</span>
        </div>
        <div class="om-row">
          <span class="om-label">地址</span>
          <span>{{ [o.province, o.city, o.district, o.address].filter(Boolean).join(' ') }}</span>
        </div>
        <div class="om-row">
          <span class="om-label">Key</span>
          <code class="om-key">{{ o.entity_key?.slice(0, 20) }}...</code>
          <button class="om-copy" @click="copyKey(o.entity_key)">复制</button>
        </div>
        <div class="om-row">
          <span class="om-label">链接</span>
          <code class="om-key">{{ getEntityUrl(o.entity_key).slice(0, 36) }}...</code>
          <button class="om-copy" @click="copyUrl(o.entity_key)">复制</button>
        </div>
        <div class="om-row">
          <span class="om-label">下单时间</span>
          <span>{{ o.created_at }}</span>
        </div>
        <div class="om-actions">
          <button v-if="o.status === 'pending'" class="om-btn om-btn--ship" @click="markStatus(o.id, 'shipped')">标记发货</button>
          <button v-if="o.status === 'shipped'" class="om-btn om-btn--done" @click="markStatus(o.id, 'completed')">标记完成</button>
        </div>
      </div>
    </div>
    <AdminPagination v-model="page" :total="totalOrders" :page-size="pageSize" @update:page-size="pageSize = $event" />
  </div>
</template>

<style scoped>
.order-manage { padding: 0; }
.om-title { font-size: 18px; font-weight: 700; margin: 0 0 20px; }
.om-loading, .om-empty { color: #999; font-size: 14px; text-align: center; padding: 40px 0; }
.om-list { display: flex; flex-direction: column; gap: 12px; }
.om-card {
  border: 1px solid #f0f0f0; border-radius: 12px; padding: 16px;
  background: #fff;
}
.om-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; margin-bottom: 6px;
}
.om-row--header { margin-bottom: 10px; }
.om-ip { font-size: 15px; font-weight: 700; }
.om-label { color: #999; min-width: 56px; flex-shrink: 0; }
.om-status {
  font-size: 12px; font-weight: 600; padding: 3px 8px; border-radius: 4px; margin-left: auto;
}
.om-status--pending { background: #fff8e1; color: #f57c00; }
.om-status--shipped { background: #e3f2fd; color: #1976d2; }
.om-status--completed { background: #e8f5e9; color: #388e3c; }
.om-key { font-size: 11px; color: #666; background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
.om-copy {
  font-size: 11px; color: #7c4dff; background: none; border: 1px solid #7c4dff;
  padding: 2px 8px; border-radius: 4px; cursor: pointer;
}
.om-copy:hover { background: #f8f5ff; }
.om-actions { margin-top: 10px; display: flex; gap: 8px; }
.om-btn {
  padding: 8px 16px; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
}
.om-btn--ship { background: #1976d2; color: #fff; }
.om-btn--ship:hover { opacity: 0.9; }
.om-btn--done { background: #388e3c; color: #fff; }
.om-btn--done:hover { opacity: 0.9; }
</style>
