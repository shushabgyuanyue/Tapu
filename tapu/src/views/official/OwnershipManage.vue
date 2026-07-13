<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { fetchOwnershipEvents } from '../../api';
import AdminPagination from '../../components/AdminPagination.vue';
import { useServerPagination } from '../../composables/useServerPagination';

const events = ref<any[]>([]);
const loading = ref(true);
const filters = ref({
  q: '',
  token: '',
  orderNo: '',
  eventType: 'transfer',
  dateFrom: '',
  dateTo: '',
});

const pagination = useServerPagination();
const { page, pageSize, total, resetPage, applyPagedResult } = pagination;

const eventTypes = [
  { value: '', label: '全部事件' },
  { value: 'transfer', label: '转赠' },
  { value: 'bind', label: '绑定' },
  { value: 'unbind', label: '主动解绑' },
  { value: 'appeal_unbind', label: '申诉解绑' },
  { value: 'official_order_created', label: '外部订单录入' },
  { value: 'token_issued', label: '生成 token' },
];

const loadEvents = async () => {
  loading.value = true;
  const result = await fetchOwnershipEvents({
    page: page.value,
    pageSize: pageSize.value,
    q: filters.value.q.trim() || undefined,
    token: filters.value.token.trim() || undefined,
    orderNo: filters.value.orderNo.trim() || undefined,
    eventType: filters.value.eventType || undefined,
    dateFrom: filters.value.dateFrom || undefined,
    dateTo: filters.value.dateTo || undefined,
  });
  applyPagedResult(result, events);
  loading.value = false;
};

const search = () => {
  resetPage();
  loadEvents();
};

const clearFilters = () => {
  filters.value = { q: '', token: '', orderNo: '', eventType: '', dateFrom: '', dateTo: '' };
  search();
};

const typeLabel = (type: string) => eventTypes.find(item => item.value === type)?.label || type;

const copyText = async (text?: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
};

onMounted(loadEvents);
watch(page, () => { loadEvents(); });
watch(pageSize, () => {
  resetPage();
  loadEvents();
});
</script>

<template>
  <div class="ownership-manage">
    <header class="page-head">
      <h2>持有记录</h2>
      <p>记录每个 token 的创建、绑定、解绑和转赠事件，为后续实体持有传承做数据铺垫。</p>
    </header>

    <section class="filter-card">
      <div class="filter-grid">
        <input v-model="filters.q" placeholder="关键词：token / 订单号 / IP" @keyup.enter="search" />
        <input v-model="filters.token" placeholder="token" @keyup.enter="search" />
        <input v-model="filters.orderNo" placeholder="订单号" @keyup.enter="search" />
        <select v-model="filters.eventType">
          <option v-for="item in eventTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
        </select>
        <input v-model="filters.dateFrom" type="date" />
        <input v-model="filters.dateTo" type="date" />
      </div>
      <div class="filter-actions">
        <button class="primary" @click="search">搜索</button>
        <button class="ghost" @click="clearFilters">清空</button>
      </div>
    </section>

    <section class="list-card">
      <div v-if="loading" class="empty">加载中...</div>
      <div v-else-if="events.length === 0" class="empty">暂无记录</div>
      <div v-else class="event-list">
        <article v-for="event in events" :key="event.id" class="event-card">
          <div class="event-head">
            <strong>{{ typeLabel(event.event_type) }}</strong>
            <span>{{ event.created_at }}</span>
          </div>

          <div class="row">
            <span>IP</span>
            <p>{{ event.group_name || '-' }}<small v-if="event.series_name"> / {{ event.series_name }}</small></p>
          </div>
          <div class="row">
            <span>token</span>
            <code>{{ (event.token || '').slice(0, 30) }}...</code>
            <button @click="copyText(event.token)">复制</button>
          </div>
          <div class="row" v-if="event.order_id || event.external_order_no">
            <span>订单号</span>
            <code>{{ event.order_id || event.external_order_no }}</code>
            <button @click="copyText(event.order_id || event.external_order_no)">复制</button>
          </div>
          <div class="row">
            <span>持有人</span>
            <p>{{ event.from_username || '未绑定' }} → {{ event.to_username || '未绑定' }}</p>
          </div>
          <div class="row">
            <span>操作者</span>
            <p>{{ event.actor_username || '-' }}</p>
          </div>
          <div class="row" v-if="event.note">
            <span>备注</span>
            <p>{{ event.note }}</p>
          </div>
        </article>
      </div>

      <AdminPagination v-model="page" :total="total" :page-size="pageSize" @update:page-size="pageSize = $event" />
    </section>
  </div>
</template>

<style scoped>
.ownership-manage {
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

.filter-card,
.list-card {
  padding: 18px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.filter-grid input,
.filter-grid select {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
  outline: none;
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.primary,
.ghost {
  padding: 8px 14px;
  border-radius: 9px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.primary {
  border: none;
  background: #1a1a1a;
  color: #fff;
}

.ghost {
  border: 1px solid #eee;
  background: #fff;
  color: #666;
}

.empty {
  padding: 42px;
  color: #999;
  text-align: center;
}

.event-list {
  display: grid;
  gap: 12px;
}

.event-card {
  padding: 15px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
}

.event-head,
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-head {
  justify-content: space-between;
  margin-bottom: 12px;
}

.event-head strong {
  font-size: 15px;
}

.event-head span {
  color: #999;
  font-size: 12px;
}

.row {
  margin-bottom: 7px;
  font-size: 13px;
}

.row > span {
  width: 64px;
  flex-shrink: 0;
  color: #999;
}

.row p {
  margin: 0;
}

.row small {
  color: #999;
}

.row code {
  padding: 3px 7px;
  border-radius: 6px;
  background: #f5f5f5;
  color: #555;
  font-size: 11px;
}

.row button {
  padding: 3px 8px;
  border: 1px solid #d8caff;
  border-radius: 6px;
  background: #fff;
  color: #7c4dff;
  cursor: pointer;
  font-size: 11px;
}

@media (max-width: 720px) {
  .filter-grid {
    grid-template-columns: 1fr;
  }

  .row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
}
</style>
