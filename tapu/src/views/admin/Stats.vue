<script setup>
import { ref, onMounted } from 'vue';
import { fetchStats } from '../../api';

const stats = ref({ totalPlays: 0, totalVideos: 0, topVideos: [], recentPlays: [] });

onMounted(async () => {
  stats.value = await fetchStats();
});
</script>

<template>
  <div>
    <h2>数据统计</h2>

    <!-- Overview cards -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalVideos }}</div>
        <div class="stat-label">视频总数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalPlays }}</div>
        <div class="stat-label">总播放次数</div>
      </div>
    </div>

    <!-- Top videos -->
    <div class="section">
      <h3>播放排行</h3>
      <table class="data-table">
        <thead>
          <tr><th>视频</th><th>播放次数</th></tr>
        </thead>
        <tbody>
          <tr v-for="v in stats.topVideos" :key="v.id">
            <td>{{ v.title }}</td>
            <td>{{ v.play_count }}</td>
          </tr>
          <tr v-if="stats.topVideos.length === 0">
            <td colspan="2" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Recent plays -->
    <div class="section">
      <h3>最近播放</h3>
      <table class="data-table">
        <thead>
          <tr><th>视频</th><th>时间</th><th>设备</th></tr>
        </thead>
        <tbody>
          <tr v-for="(p, i) in stats.recentPlays" :key="i">
            <td>{{ p.title }}</td>
            <td>{{ p.played_at }}</td>
            <td class="ua">{{ p.user_agent?.slice(0, 50) }}</td>
          </tr>
          <tr v-if="stats.recentPlays.length === 0">
            <td colspan="3" class="empty">暂无数据</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
h2 { margin: 0 0 16px; font-size: 20px; }
h3 { margin: 0 0 12px; font-size: 16px; }

.stat-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  padding: 20px 24px;
  border-radius: 8px;
  min-width: 140px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #111;
}

.stat-label {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.section { margin-bottom: 24px; }

.data-table {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 10px 12px;
  text-align: left;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  background: #fafafa;
  font-weight: 500;
}

.ua { font-size: 12px; color: #999; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.empty { text-align: center; color: #999; padding: 24px; }
</style>
