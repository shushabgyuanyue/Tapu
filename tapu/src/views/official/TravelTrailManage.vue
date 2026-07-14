<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  addTravelTrailPlace,
  createTravelTrail,
  deleteTravelTrailPlace,
  fetchTravelTrails,
  type TravelTrailInput,
} from '../../api';

const loading = ref(true);
const trails = ref<any[]>([]);
const msg = ref('');
const msgError = ref(false);
const placeInputs = ref<Record<string, { name: string; note: string }>>({});

const form = ref<TravelTrailInput>({
  title: '',
  subtitle: '',
  object_label: '',
  theme_color: '#2f6f5e',
  status: 'active',
  first_place: '',
  first_place_note: '',
});

const totalPlaces = computed(() => trails.value.reduce((sum, trail) => sum + Number(trail.place_count || trail.places?.length || 0), 0));

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const resetForm = () => {
  form.value = {
    title: '',
    subtitle: '',
    object_label: '',
    theme_color: '#2f6f5e',
    status: 'active',
    first_place: '',
    first_place_note: '',
  };
};

const loadData = async () => {
  loading.value = true;
  const rows = await fetchTravelTrails();
  trails.value = Array.isArray(rows) ? rows : [];
  for (const trail of trails.value) {
    if (!placeInputs.value[trail.id]) placeInputs.value[trail.id] = { name: '', note: '' };
  }
  loading.value = false;
};

const submit = async () => {
  const title = form.value.title.trim();
  if (!title) return showMessage('请先填写轨迹标题', true);

  const result = await createTravelTrail({ ...form.value, title });
  if (result.error) return showMessage(result.error, true);

  const url = `${window.location.origin}/trail?key=${result.token}`;
  showMessage(`旅行轨迹已创建：${url}`);
  resetForm();
  await loadData();
};

const appendPlace = async (trail: any) => {
  const input = placeInputs.value[trail.id] || { name: '', note: '' };
  const name = input.name.trim();
  if (!name) return showMessage('请输入新的地点', true);
  const result = await addTravelTrailPlace(trail.id, {
    name,
    note: input.note.trim() || undefined,
  });
  if (result.error) return showMessage(result.error, true);
  placeInputs.value[trail.id] = { name: '', note: '' };
  showMessage('新的地点已加入轨迹');
  await loadData();
};

const removePlace = async (trail: any, place: any) => {
  if (!confirm(`确定移除「${place.name}」？`)) return;
  const result = await deleteTravelTrailPlace(trail.id, place.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('地点已移除');
  await loadData();
};

const copyLink = async (trail: any) => {
  await navigator.clipboard.writeText(`${window.location.origin}/trail?key=${trail.token}`);
  showMessage('触碰链接已复制');
};

onMounted(loadData);
</script>

<template>
  <div class="travel-manage">
    <header class="hero">
      <div>
        <p>Travel Trail App</p>
        <h2>旅行轨迹</h2>
        <span>贴在行李、护照夹、旅行手账或冰箱贴上。碰一下，看见去过的地方被连成一条动态路线。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步列表' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="workspace">
      <article class="panel create-panel">
        <div class="panel-head">
          <span>Creator Flow</span>
          <h3>创建一条旅行轨迹</h3>
          <p>先输入一个标题和第一个地点。后续每次只需要补一个新地点，就能把路线继续画下去。</p>
        </div>

        <div class="form-grid">
          <label><span>轨迹标题</span><input v-model="form.title" placeholder="例如：一只箱子的夏天" /></label>
          <label><span>物品标签</span><input v-model="form.object_label" placeholder="例如：银色行李箱 / 护照夹贴纸" /></label>
          <label><span>第一个地点</span><input v-model="form.first_place" placeholder="例如：上海虹桥站" /></label>
          <label><span>主题色</span><input v-model="form.theme_color" type="color" /></label>
          <label class="full"><span>一句说明</span><textarea v-model="form.subtitle" placeholder="这条线不追求完整，只记录那些真的抵达过的地方。"></textarea></label>
          <label class="full"><span>第一站备注，可选</span><input v-model="form.first_place_note" placeholder="例如：从这里拖着箱子出发。" /></label>
        </div>

        <button class="primary" @click="submit">生成旅行轨迹</button>
      </article>

      <article class="panel side-panel">
        <div class="metric">
          <span>Total Stops</span>
          <strong>{{ totalPlaces }}</strong>
          <p>每个地点都是一次轻输入，也是一次现实移动的数字痕迹。</p>
        </div>
        <div class="note-card">
          <strong>这个应用验证什么？</strong>
          <p>它测试“持续更新型作品”：同一个 token 不断追加状态，触碰页每次都呈现一条更完整的路线。</p>
        </div>
      </article>
    </section>

    <section class="list-panel">
      <div class="list-head">
        <h3>已有轨迹</h3>
        <span>{{ trails.length }} trails</span>
      </div>

      <div v-if="loading" class="empty">正在加载...</div>
      <div v-else-if="trails.length === 0" class="empty">还没有旅行轨迹。先给一件行李写下第一站。</div>
      <div v-else class="trail-list">
        <article v-for="trail in trails" :key="trail.id" class="trail-item">
          <div class="trail-top">
            <div>
              <span>{{ trail.status }} / {{ trail.intent || 'journey' }} / v{{ trail.work_version || 1 }}</span>
              <h4>{{ trail.title }}</h4>
              <p>{{ trail.subtitle || '暂无说明' }}</p>
              <small>{{ trail.place_count || trail.places?.length || 0 }} stops · {{ trail.tap_count || 0 }} taps</small>
            </div>
            <div class="item-actions">
              <button @click="copyLink(trail)">复制链接</button>
              <a :href="`/trail?key=${trail.token}`" target="_blank">预览</a>
            </div>
          </div>

          <div class="place-line" v-if="trail.places?.length">
            <button
              v-for="place in trail.places"
              :key="place.id"
              class="place-chip"
              @click="removePlace(trail, place)"
              :title="place.note || '点击移除'"
            >
              {{ place.name }}
            </button>
          </div>

          <div class="append-row">
            <input v-model="placeInputs[trail.id].name" placeholder="输入新的地点" @keyup.enter="appendPlace(trail)" />
            <input v-model="placeInputs[trail.id].note" placeholder="备注，可选" @keyup.enter="appendPlace(trail)" />
            <button @click="appendPlace(trail)">加入轨迹</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.travel-manage {
  display: grid;
  gap: 16px;
}

.hero,
.panel,
.list-panel {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.86);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.2), transparent 30%),
    linear-gradient(135deg, #17211d, #2f6f5e 58%, #9a6a2f);
}

.hero p,
.hero h2,
.hero span {
  margin: 0;
}

.hero p,
.panel-head span,
.metric span {
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.hero h2 {
  margin-top: 8px;
  font-size: clamp(30px, 4vw, 42px);
}

.hero span {
  display: block;
  max-width: 760px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.7;
}

.hero button,
.primary,
.item-actions button,
.item-actions a,
.append-row button {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.hero button,
.item-actions button,
.item-actions a {
  color: #17211d;
  background: #fff;
}

.msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eefaf2;
  color: #16803a;
  font-size: 13px;
  line-height: 1.6;
}

.msg.error {
  background: #fff1f4;
  color: #c92752;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
}

.panel,
.list-panel {
  min-width: 0;
  padding: 18px;
  border-radius: 22px;
}

.panel-head h3,
.list-head h3,
.trail-item h4 {
  margin: 0;
}

.panel-head p,
.note-card p,
.trail-item p {
  color: #756c78;
  line-height: 1.7;
}

.panel-head span,
.metric span {
  color: #2f6f5e;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.full {
  grid-column: 1 / -1;
}

label {
  display: grid;
  gap: 6px;
  color: #675b62;
  font-size: 12px;
  font-weight: 900;
}

input,
textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #e6ded6;
  border-radius: 12px;
  padding: 10px 11px;
  outline: none;
}

textarea {
  min-height: 90px;
  resize: vertical;
  line-height: 1.7;
}

.primary,
.append-row button {
  margin-top: 14px;
  color: #fff;
  background: linear-gradient(135deg, #17211d, #2f6f5e);
}

.side-panel {
  display: grid;
  align-content: start;
  gap: 14px;
}

.metric,
.note-card {
  padding: 16px;
  border-radius: 18px;
  background: #f6f2ed;
}

.metric strong {
  display: block;
  margin-top: 8px;
  font-size: 42px;
  letter-spacing: -0.08em;
}

.metric p {
  margin: 4px 0 0;
  color: #756c78;
}

.list-head,
.trail-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.list-head {
  margin-bottom: 12px;
}

.empty {
  padding: 34px;
  color: #9a9090;
  text-align: center;
}

.trail-list {
  display: grid;
  gap: 10px;
}

.trail-item {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #efe8e0;
  border-radius: 18px;
  background: #fff;
}

.trail-item span,
.trail-item small,
.list-head span {
  color: #9a9090;
  font-size: 12px;
}

.trail-item h4 {
  margin-top: 4px;
  font-size: 18px;
}

.trail-item p {
  margin: 6px 0;
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.item-actions button,
.item-actions a {
  border: 1px solid #efe8e0;
}

.place-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.place-chip {
  border: 0;
  border-radius: 999px;
  padding: 7px 10px;
  color: #2f6f5e;
  background: #eaf3ef;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.append-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 8px;
}

.append-row button {
  margin: 0;
}

@media (max-width: 980px) {
  .workspace,
  .form-grid,
  .append-row {
    grid-template-columns: 1fr;
  }

  .hero,
  .trail-top {
    display: grid;
  }

  .item-actions {
    justify-content: flex-start;
  }
}
</style>
