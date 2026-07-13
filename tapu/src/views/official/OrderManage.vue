<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue';
import { createExternalOrder, fetchGroups, fetchOrders, updateOrderStatus } from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const orders = ref<any[]>([]);
const groups = ref<any[]>([]);
const loading = ref(true);
const creating = ref(false);
const lastCreated = ref<any>(null);

const filters = ref({
  q: '',
  orderNo: '',
  token: '',
  dateFrom: '',
  dateTo: '',
});

const form = ref({
  group_id: '',
  order_no: '',
  token: '',
  status: 'completed',
});

const pagination = useServerPagination();
const { page, pageSize, total: totalOrders, resetPage, applyPagedResult } = pagination;

const generateOrderNo = () => {
  const date = new Date();
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  const suffix = Math.random().toString(16).slice(2, 10).toUpperCase();
  form.value.order_no = `WM${ymd}${suffix}`;
};

const loadOrders = async () => {
  loading.value = true;
  const result = await fetchOrders({
    page: page.value,
    pageSize: pageSize.value,
    q: filters.value.q.trim() || undefined,
    orderNo: filters.value.orderNo.trim() || undefined,
    token: filters.value.token.trim() || undefined,
    dateFrom: filters.value.dateFrom || undefined,
    dateTo: filters.value.dateTo || undefined,
  });
  applyPagedResult(result, orders);
  loading.value = false;
};

const loadGroups = async () => {
  const rows = await fetchGroups();
  groups.value = Array.isArray(rows) ? rows : [];
  if (!form.value.group_id && groups.value.length > 0) {
    form.value.group_id = groups.value[0].id;
  }
};

const search = () => {
  resetPage();
  loadOrders();
};

const clearFilters = () => {
  filters.value = { q: '', orderNo: '', token: '', dateFrom: '', dateTo: '' };
  search();
};

const submitOrder = async () => {
  if (!form.value.group_id) {
    toast?.show('请选择 IP', 2200, 'error');
    return;
  }

  creating.value = true;
  const result = await createExternalOrder({
    group_id: form.value.group_id,
    order_no: form.value.order_no.trim() || undefined,
    token: form.value.token.trim() || undefined,
    status: form.value.status,
  });
  creating.value = false;

  if (result.error) {
    toast?.show(result.error, 2600, 'error');
    return;
  }

  lastCreated.value = result;
  form.value.order_no = '';
  form.value.token = '';
  toast?.show('外部订单已录入，实体 token 已生成', 2600, 'success');
  resetPage();
  await loadOrders();
};

const statusLabel = (status: string) => {
  if (status === 'shipped') return '已发货';
  if (status === 'completed') return '已完成';
  return '待处理';
};

const sourceLabel = (source?: string) => source === 'external' ? '外部订单' : '平台订单';

const markStatus = async (orderId: string, status: string) => {
  const data = await updateOrderStatus(orderId, status);
  if (data.success) {
    const order = orders.value.find(item => item.id === orderId);
    if (order) order.status = status;
    toast?.show('状态已更新', 2000, 'success');
  } else {
    toast?.show(data.error || '更新失败', 2500, 'error');
  }
};

const copyText = async (text?: string, label = '已复制') => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast?.show(label, 1800, 'success');
};

const getEntityUrl = (token?: string) => {
  if (!token) return '';
  return `${window.location.origin}/play?key=${encodeURIComponent(token)}`;
};

onMounted(async () => {
  await Promise.all([loadGroups(), loadOrders()]);
});

watch(page, () => { loadOrders(); });
watch(pageSize, () => {
  resetPage();
  loadOrders();
});
</script>

<template>
  <div class="order-manage">
    <header class="page-head">
      <h2>订单管理</h2>
      <p>购买已迁移到外部平台。这里手动录入订单号与实体 token，录入后即代表该实体已售出并可被用户绑定。</p>
    </header>

    <section class="entry-card">
      <div class="section-title">
        <h3>录入外部订单</h3>
        <button class="ghost-btn" @click="generateOrderNo">生成测试订单号</button>
      </div>

      <div class="entry-grid">
        <label>
          <span>选择 IP</span>
          <select v-model="form.group_id">
            <option value="" disabled>请选择 IP</option>
            <option v-for="group in groups" :key="group.id" :value="group.id">
              {{ group.series_name ? `${group.series_name} / ` : '' }}{{ group.name }}
            </option>
          </select>
        </label>

        <label>
          <span>外部订单号</span>
          <input v-model="form.order_no" placeholder="可手动填写；为空时后端也会生成" />
        </label>

        <label>
          <span>token</span>
          <input v-model="form.token" placeholder="可手动填写；为空则随机生成唯一 token" />
        </label>

        <label>
          <span>状态</span>
          <select v-model="form.status">
            <option value="pending">待处理</option>
            <option value="shipped">已发货</option>
            <option value="completed">已完成</option>
          </select>
        </label>
      </div>

      <button class="primary-btn" :disabled="creating" @click="submitOrder">
        {{ creating ? '录入中...' : '录入并生成实体' }}
      </button>

      <div v-if="lastCreated" class="created-result">
        <strong>最近生成</strong>
        <span>订单号：{{ lastCreated.order_no }}</span>
        <button @click="copyText(lastCreated.token, 'token 已复制')">复制 token</button>
        <button @click="copyText(getEntityUrl(lastCreated.token), '访问链接已复制')">复制访问链接</button>
      </div>
    </section>

    <section class="filter-card">
      <div class="section-title">
        <h3>搜索订单</h3>
        <button class="ghost-btn" @click="clearFilters">清空</button>
      </div>

      <div class="filter-grid">
        <input v-model="filters.q" placeholder="关键词：订单号 / token / IP" @keyup.enter="search" />
        <input v-model="filters.orderNo" placeholder="订单号" @keyup.enter="search" />
        <input v-model="filters.token" placeholder="token" @keyup.enter="search" />
        <input v-model="filters.dateFrom" type="date" />
        <input v-model="filters.dateTo" type="date" />
        <button class="primary-btn" @click="search">搜索</button>
      </div>
    </section>

    <section class="list-card">
      <h3>订单列表</h3>
      <div v-if="loading" class="om-loading">加载中...</div>
      <div v-else-if="orders.length === 0" class="om-empty">暂无订单</div>
      <div v-else class="om-list">
        <article v-for="order in orders" :key="order.id" class="om-card">
          <div class="om-row om-row--header">
            <div>
              <strong class="om-ip">{{ order.group_name || 'IP' }}</strong>
              <span class="source-pill">{{ sourceLabel(order.order_source) }}</span>
            </div>
            <span class="om-status" :class="'om-status--' + order.status">{{ statusLabel(order.status) }}</span>
          </div>

          <div class="om-row">
            <span class="om-label">订单号</span>
            <code class="om-key">{{ order.external_order_no || order.id }}</code>
            <button class="om-copy" @click="copyText(order.external_order_no || order.id, '订单号已复制')">复制</button>
          </div>

          <div class="om-row">
            <span class="om-label">token</span>
            <code class="om-key">{{ (order.token || order.entity_key || '').slice(0, 28) }}...</code>
            <button class="om-copy" @click="copyText(order.token || order.entity_key, 'token 已复制')">复制</button>
          </div>

          <div class="om-row">
            <span class="om-label">访问链接</span>
            <code class="om-key">{{ getEntityUrl(order.token || order.entity_key).slice(0, 42) }}...</code>
            <button class="om-copy" @click="copyText(getEntityUrl(order.token || order.entity_key), '访问链接已复制')">复制</button>
          </div>

          <div class="om-row">
            <span class="om-label">创建时间</span>
            <span>{{ order.created_at }}</span>
          </div>

          <div class="om-row">
            <span class="om-label">绑定状态</span>
            <span>{{ order.entity_user_id ? '已绑定账号' : '未绑定' }}</span>
          </div>

          <div class="om-row">
            <span class="om-label">NFC 写入</span>
            <span>{{ order.nfc_written_at ? order.nfc_written_at : '待确认' }}</span>
          </div>

          <div class="om-row">
            <span class="om-label">token 发放</span>
            <span>{{ order.token_delivered_at ? order.token_delivered_at : '待确认' }}</span>
          </div>

          <div class="om-actions">
            <button v-if="order.status !== 'shipped'" class="om-btn om-btn--ship" @click="markStatus(order.id, 'shipped')">标记发货</button>
            <button v-if="order.status !== 'completed'" class="om-btn om-btn--done" @click="markStatus(order.id, 'completed')">标记完成</button>
          </div>
        </article>
      </div>

      <AdminPagination v-model="page" :total="totalOrders" :page-size="pageSize" @update:page-size="pageSize = $event" />
    </section>
  </div>
</template>

<style scoped>
.order-manage {
  display: grid;
  gap: 18px;
}

.page-head h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 800;
}

.page-head p {
  margin: 0;
  color: #888;
  font-size: 13px;
  line-height: 1.7;
}

.entry-card,
.filter-card,
.list-card {
  padding: 18px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.section-title h3,
.list-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}

.entry-grid,
.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.filter-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.entry-grid label {
  display: grid;
  gap: 6px;
  color: #666;
  font-size: 12px;
  font-weight: 700;
}

.entry-grid input,
.entry-grid select,
.filter-grid input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  background: #fff;
  color: #222;
  font-size: 13px;
  outline: none;
}

.entry-grid input:focus,
.entry-grid select:focus,
.filter-grid input:focus {
  border-color: #7c4dff;
}

.primary-btn,
.ghost-btn {
  padding: 9px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.primary-btn {
  margin-top: 14px;
  border: none;
  background: #1a1a1a;
  color: #fff;
}

.primary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.ghost-btn {
  border: 1px solid #eee;
  background: #fff;
  color: #666;
}

.created-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f5fbf4;
  color: #2f6c36;
  font-size: 12px;
}

.created-result button {
  border: 1px solid #cfe7ca;
  border-radius: 999px;
  background: #fff;
  color: #2f6c36;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
}

.om-loading,
.om-empty {
  padding: 40px 0;
  color: #999;
  font-size: 14px;
  text-align: center;
}

.om-list {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.om-card {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  background: #fff;
}

.om-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 7px;
  font-size: 13px;
}

.om-row--header {
  justify-content: space-between;
  margin-bottom: 12px;
}

.om-ip {
  font-size: 15px;
}

.source-pill {
  display: inline-flex;
  margin-left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #f5f5f5;
  color: #777;
  font-size: 11px;
}

.om-label {
  min-width: 64px;
  flex-shrink: 0;
  color: #999;
}

.om-status {
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.om-status--pending {
  background: #fff8e1;
  color: #f57c00;
}

.om-status--shipped {
  background: #e3f2fd;
  color: #1976d2;
}

.om-status--completed {
  background: #e8f5e9;
  color: #388e3c;
}

.om-key {
  padding: 3px 7px;
  border-radius: 6px;
  background: #f5f5f5;
  color: #555;
  font-size: 11px;
}

.om-copy {
  padding: 3px 8px;
  border: 1px solid #d8caff;
  border-radius: 6px;
  background: #fff;
  color: #7c4dff;
  cursor: pointer;
  font-size: 11px;
}

.om-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.om-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.om-btn--ship {
  background: #1976d2;
}

.om-btn--done {
  background: #388e3c;
}

@media (max-width: 720px) {
  .entry-grid,
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .om-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
