<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  addTravelTrailPlace,
  createTravelTrail,
  deleteTravelTrailPlace,
  fetchTravelTrails,
  setTravelTrailNextDestination,
  type TravelTrailInput,
} from '../../api';

const loading = ref(true);
const trails = ref<any[]>([]);
const msg = ref('');
const msgError = ref(false);
const placeInputs = ref<Record<string, { name: string; note: string }>>({});
const nextInputs = ref<Record<string, { next_place: string; next_place_note: string }>>({});

const form = ref<TravelTrailInput>({
  title: '',
  subtitle: '',
  object_label: '',
  theme_color: '#2f6f5e',
  status: 'active',
  first_place: '',
  first_place_note: '',
  next_place: '',
  next_place_note: '',
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
    next_place: '',
    next_place_note: '',
  };
};

const loadData = async () => {
  loading.value = true;
  const rows = await fetchTravelTrails();
  trails.value = Array.isArray(rows) ? rows : [];
  for (const trail of trails.value) {
    if (!placeInputs.value[trail.id]) placeInputs.value[trail.id] = { name: '', note: '' };
    if (!nextInputs.value[trail.id]) {
      nextInputs.value[trail.id] = {
        next_place: trail.next_place || '',
        next_place_note: trail.next_place_note || '',
      };
    } else {
      nextInputs.value[trail.id].next_place = trail.next_place || '';
      nextInputs.value[trail.id].next_place_note = trail.next_place_note || '';
    }
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

const updateNextDestination = async (trail: any) => {
  const input = nextInputs.value[trail.id] || { next_place: '', next_place_note: '' };
  const result = await setTravelTrailNextDestination(trail.id, {
    next_place: input.next_place.trim() || undefined,
    next_place_note: input.next_place_note.trim() || undefined,
  });
  if (result.error) return showMessage(result.error, true);
  showMessage(input.next_place.trim() ? '下一站仪式已更新' : '下一站已清空');
  await loadData();
};

const confirmNextAsPlace = async (trail: any) => {
  const nextPlace = String(trail.next_place || '').trim();
  if (!nextPlace) return showMessage('还没有下一站可以加入轨迹', true);
  const placeResult = await addTravelTrailPlace(trail.id, {
    name: nextPlace,
    note: trail.next_place_note || undefined,
  });
  if (placeResult.error) return showMessage(placeResult.error, true);

  const clearResult = await setTravelTrailNextDestination(trail.id, {});
  if (clearResult.error) return showMessage(clearResult.error, true);

  showMessage(`「${nextPlace}」已作为归来的一站加入轨迹`);
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
        <span>贴在行李、护照夹或旅行手账上。碰一下不是记录 GPS，而是展开一次出发与归来的仪式。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步列表' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="workspace">
      <article class="panel create-panel">
        <div class="panel-head">
          <span>Creator Flow</span>
          <h3>创建一条旅行轨迹</h3>
          <p>每条轨迹只回答一个问题：我的人生走过了哪些地方？已走过的站点是过去，下一站是出发前的仪式。</p>
        </div>

        <div class="form-grid">
          <label><span>轨迹标题</span><input v-model="form.title" placeholder="例如：一只箱子的夏天" /></label>
          <label><span>物品标签</span><input v-model="form.object_label" placeholder="例如：银色行李箱 / 护照夹贴纸" /></label>
          <label><span>已走过的第一站</span><input v-model="form.first_place" placeholder="例如：上海虹桥站" /></label>
          <label><span>下一站</span><input v-model="form.next_place" placeholder="例如：东京" /></label>
          <label><span>主题色</span><input v-model="form.theme_color" type="color" /></label>
          <label><span>下一站心情，可选</span><input v-model="form.next_place_note" placeholder="例如：出发前，箱子已经有点兴奋。" /></label>
          <label class="full"><span>一句说明</span><textarea v-model="form.subtitle" placeholder="每次出发前碰一下行李箱，回来后再把这一站接进人生轨迹。"></textarea></label>
          <label class="full"><span>第一站备注，可选</span><input v-model="form.first_place_note" placeholder="例如：从这里拖着箱子出发。" /></label>
        </div>

        <button class="primary" @click="submit">生成旅行轨迹</button>
      </article>

      <article class="panel side-panel">
        <div class="metric">
          <span>Total Stops</span>
          <strong>{{ totalPlaces }}</strong>
          <p>每个地点都是一次归来确认，不追踪位置，只记录人生章节。</p>
        </div>
        <div class="principle-card">
          <span>Life Question</span>
          <strong>我的人生走过了哪些地方？</strong>
          <p>旅行轨迹负责“去过哪里”，纪念瞬间负责“在那里发生了什么”。两个应用形成层次，不抢功能。</p>
        </div>
        <div class="note-card">
          <strong>这个应用验证什么？</strong>
          <p>它测试“物品本身成为交互对象”：行李箱跟着人移动，贴纸承载出发前和回来后的轻动作。</p>
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
              <small>
                {{ trail.place_count || trail.places?.length || 0 }} stops · {{ trail.tap_count || 0 }} taps
                <template v-if="trail.next_place"> · 下一站：{{ trail.next_place }}</template>
              </small>
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

          <div class="next-card">
            <div>
              <strong>下一站仪式</strong>
              <p v-if="trail.next_place">当前下一站：{{ trail.next_place }}</p>
              <p v-else>还没有下一站。触碰页会引导用户写下一个目的地。</p>
            </div>
            <div class="next-row">
              <input v-model="nextInputs[trail.id].next_place" placeholder="下一站，例如：东京" @keyup.enter="updateNextDestination(trail)" />
              <input v-model="nextInputs[trail.id].next_place_note" placeholder="出发前心情，可选" @keyup.enter="updateNextDestination(trail)" />
              <button @click="updateNextDestination(trail)">更新下一站</button>
              <button class="ghost" :disabled="!trail.next_place" @click="confirmNextAsPlace(trail)">归来并加入轨迹</button>
            </div>
          </div>

          <div class="append-row">
            <input v-model="placeInputs[trail.id].name" placeholder="手动补一站" @keyup.enter="appendPlace(trail)" />
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
.next-row button,
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
.item-actions a,
.next-row .ghost {
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
.principle-card,
.note-card {
  padding: 16px;
  border-radius: 18px;
  background: #f6f2ed;
}

.principle-card {
  border: 1px solid #e6ded6;
  background:
    radial-gradient(circle at 100% 0%, rgba(47, 111, 94, 0.12), transparent 34%),
    #fffaf4;
}

.principle-card span {
  color: #2f6f5e;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.principle-card strong {
  display: block;
  margin-top: 8px;
  color: #17211d;
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

.next-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5efe9;
  border-radius: 18px;
  background: #f3faf6;
}

.next-card strong,
.next-card p {
  margin: 0;
}

.next-card p {
  margin-top: 4px;
  color: #756c78;
  font-size: 13px;
}

.next-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
  gap: 8px;
}

.next-row button {
  margin: 0;
  color: #fff;
  background: linear-gradient(135deg, #17211d, #2f6f5e);
}

.next-row button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.next-row .ghost {
  border: 1px solid #dce9e2;
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
  .next-row,
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
