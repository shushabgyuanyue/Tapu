<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchStats, fetchDailyStats, fetchGroups, fetchLeaderboard } from '../../api';
import BarChart from '../../components/BarChart.vue';
import DateRangePicker from '../../components/DateRangePicker.vue';

const stats = ref<any>({ totalPlays: 0, totalVideos: 0, topVideos: [], defaultCount: 0 });
const dailyData = ref<Array<{ label: string; value: number }>>([]);
const groups = ref<any[]>([]);
const leaderboard = ref<any[]>([]);
const filterGroup = ref('');
const filterFrom = ref('');
const filterTo = ref('');

const loadData = async () => {
  const params: any = {};
  if (filterGroup.value) params.group_id = filterGroup.value;
  if (filterFrom.value) params.from = filterFrom.value;
  if (filterTo.value) params.to = filterTo.value;

  const [overview, daily, groupList, lb] = await Promise.all([
    fetchStats(params),
    fetchDailyStats(params),
    fetchGroups(),
    fetchLeaderboard(),
  ]);

  stats.value = overview;
  groups.value = groupList;
  leaderboard.value = lb;
  dailyData.value = daily.map((d: any) => ({
    label: d.date?.slice(5) || '',
    value: d.count,
  }));
};

onMounted(loadData);

const onDateChange = (from: string, to: string) => {
  filterFrom.value = from;
  filterTo.value = to;
  loadData();
};

const onGroupChange = () => { loadData(); };
</script>

<template>
  <div>
    <div class="page-top">
      <h1>数据统计</h1>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterGroup" @change="onGroupChange" class="sel">
        <option value="">全部分组</option>
        <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      <DateRangePicker @change="onDateChange" />
    </div>

    <!-- Cards -->
    <div class="cards">
      <div class="card">
        <div class="card-val">{{ stats.totalVideos }}</div>
        <div class="card-label">视频总数</div>
      </div>
      <div class="card">
        <div class="card-val">{{ stats.totalPlays }}</div>
        <div class="card-label">累计播放</div>
      </div>
      <div class="card">
        <div class="card-val">{{ stats.defaultCount }}</div>
        <div class="card-label">默认设置次数</div>
      </div>
    </div>

    <!-- Chart -->
    <div class="section">
      <h2>每日播放量</h2>
      <div class="chart-box">
        <BarChart v-if="dailyData.length" :data="dailyData" :height="160" />
        <p v-else class="empty-hint">暂无播放数据</p>
      </div>
    </div>

    <!-- Top -->
    <div class="section">
      <h2>播放排行</h2>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>视频</th><th>播放次数</th></tr></thead>
          <tbody>
            <tr v-for="v in stats.topVideos" :key="v.id">
              <td>{{ v.title }}</td>
              <td class="td-num">{{ v.play_count }}</td>
            </tr>
            <tr v-if="!stats.topVideos.length"><td colspan="2" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Leaderboard -->
    <div class="section">
      <h2>社区排行榜</h2>
      <div class="table-wrap">
        <table class="tbl">
          <thead><tr><th>IP名称</th><th>系列</th><th>播放</th><th>购买</th></tr></thead>
          <tbody>
            <tr v-for="g in leaderboard" :key="g.id">
              <td>{{ g.name }}</td>
              <td class="td-dim">{{ g.series_name || '-' }}</td>
              <td class="td-num">{{ g.play_count }}</td>
              <td class="td-num">{{ g.purchase_count }}</td>
            </tr>
            <tr v-if="!leaderboard.length"><td colspan="4" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-top { margin-bottom: 16px; }
.page-top h1 { font-size: 16px; font-weight: 600; margin: 0; }

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.sel {
  padding: 5px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--bg-card);
  color: var(--text-secondary);
  outline: none;
}

.cards {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 20px;
  min-width: 120px;
}
.card-val { font-size: 24px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px; }
.card-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.section { margin-bottom: 24px; }
.section h2 { font-size: 13px; font-weight: 600; margin: 0 0 10px; color: var(--text-secondary); }

.chart-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.table-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th {
  padding: 7px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  background: var(--bg-page);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.tbl td { padding: 7px 12px; border-bottom: 1px solid var(--border-light); }

.td-num { font-weight: 600; font-variant-numeric: tabular-nums; }
.td-dim { color: var(--text-muted); font-size: 12px; }
.td-ua { color: var(--text-muted); font-size: 11px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { text-align: center; color: var(--text-muted); padding: 24px; }
.empty-hint { text-align: center; color: var(--text-muted); font-size: 13px; padding: 24px 0; margin: 0; }
</style>
