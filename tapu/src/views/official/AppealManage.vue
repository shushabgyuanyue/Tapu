<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { fetchUnbindAppeals, resolveUnbindAppeal } from '../../api';

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');
const appeals = ref<any[]>([]);
const loading = ref(true);

const loadAppeals = async () => {
  loading.value = true;
  const rows = await fetchUnbindAppeals();
  appeals.value = Array.isArray(rows) ? rows : [];
  loading.value = false;
};

const statusLabel = (status: string) => {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已拒绝';
  return '待处理';
};

const copyText = async (text?: string) => {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  toast?.show('已复制', 1800, 'success');
};

const handleAppeal = async (id: string, action: 'approve' | 'reject') => {
  const result = await resolveUnbindAppeal(id, action);
  if (result.error) {
    toast?.show(result.error, 2500, 'error');
    return;
  }
  toast?.show(action === 'approve' ? '已通过申诉并解绑实体' : '已拒绝申诉', 2200, 'success');
  await loadAppeals();
};

onMounted(loadAppeals);
</script>

<template>
  <div class="appeal-manage">
    <header class="page-head">
      <h2>申诉管理</h2>
      <p>处理用户因 token 泄露或抢绑定提交的订单号申诉。通过后会解绑对应实体，并写入持有记录。</p>
    </header>

    <div v-if="loading" class="empty">加载中...</div>
    <div v-else-if="appeals.length === 0" class="empty">暂无申诉</div>
    <section v-else class="appeal-list">
      <article v-for="appeal in appeals" :key="appeal.id" class="appeal-card">
        <div class="card-head">
          <strong>{{ appeal.group_name || '未匹配实体' }}</strong>
          <span :class="'status status--' + appeal.status">{{ statusLabel(appeal.status) }}</span>
        </div>

        <div class="row">
          <span>订单号</span>
          <code>{{ appeal.order_no }}</code>
          <button @click="copyText(appeal.order_no)">复制</button>
        </div>
        <div class="row" v-if="appeal.token">
          <span>token</span>
          <code>{{ appeal.token.slice(0, 28) }}...</code>
          <button @click="copyText(appeal.token)">复制</button>
        </div>
        <div class="row">
          <span>申请人</span>
          <p>{{ appeal.requester_username || '未登录提交' }}</p>
        </div>
        <div class="row" v-if="appeal.reason">
          <span>说明</span>
          <p>{{ appeal.reason }}</p>
        </div>
        <div class="row">
          <span>提交时间</span>
          <p>{{ appeal.created_at }}</p>
        </div>

        <div class="actions" v-if="appeal.status === 'pending'">
          <button class="approve" @click="handleAppeal(appeal.id, 'approve')">通过并解绑</button>
          <button class="reject" @click="handleAppeal(appeal.id, 'reject')">拒绝</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.appeal-manage {
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

.empty {
  padding: 44px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
  color: #999;
  text-align: center;
}

.appeal-list {
  display: grid;
  gap: 12px;
}

.appeal-card {
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
}

.card-head,
.row,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-head {
  justify-content: space-between;
  margin-bottom: 12px;
}

.status {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.status--pending {
  background: #fff8e1;
  color: #f57c00;
}

.status--approved {
  background: #e8f5e9;
  color: #388e3c;
}

.status--rejected {
  background: #ffebee;
  color: #d32f2f;
}

.row {
  margin-bottom: 7px;
  font-size: 13px;
}

.row span {
  width: 64px;
  flex-shrink: 0;
  color: #999;
}

.row code {
  padding: 3px 7px;
  border-radius: 6px;
  background: #f5f5f5;
  color: #555;
  font-size: 11px;
}

.row p {
  margin: 0;
  color: #444;
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

.actions {
  margin-top: 12px;
}

.actions button {
  padding: 8px 14px;
  border: none;
  border-radius: 9px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.approve {
  background: #388e3c;
}

.reject {
  background: #d32f2f;
}
</style>
