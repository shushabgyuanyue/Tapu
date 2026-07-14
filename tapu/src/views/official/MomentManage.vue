<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createMomentToken,
  deleteMomentToken,
  fetchMomentTokens,
  type ContentCollectionBlockInput,
  type MomentInput,
} from '../../api';

const loading = ref(true);
const moments = ref<any[]>([]);
const msg = ref('');
const msgError = ref(false);

const defaultBlocks = (): ContentCollectionBlockInput[] => [
  { kind: 'heading', body: '那一刻发生了什么' },
  { kind: 'text', body: '' },
  { kind: 'image', url: '', caption: '' },
  { kind: 'quote', body: '', caption: '' },
];

const form = ref<MomentInput>({
  title: '',
  subtitle: '',
  object_label: '',
  event_date: '',
  place: '',
  cover_url: '',
  theme_color: '#9a6a2f',
  status: 'active',
  collection_status: 'published',
  primary_modality: 'mixed',
  blocks: defaultBlocks(),
});

const activeMoments = computed(() => moments.value.filter(item => item.status === 'active'));

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const resetForm = () => {
  form.value = {
    title: '',
    subtitle: '',
    object_label: '',
    event_date: '',
    place: '',
    cover_url: '',
    theme_color: '#9a6a2f',
    status: 'active',
    collection_status: 'published',
    primary_modality: 'mixed',
    blocks: defaultBlocks(),
  };
};

const loadData = async () => {
  loading.value = true;
  const rows = await fetchMomentTokens();
  moments.value = Array.isArray(rows) ? rows : [];
  loading.value = false;
};

const cleanBlocks = () => (form.value.blocks || [])
  .map((block, index) => ({ ...block, sort_order: index }))
  .filter(block => block.kind && (block.body || block.url || block.title || block.action || block.caption));

const submit = async () => {
  const title = form.value.title.trim();
  if (!title) return showMessage('请先填写纪念瞬间标题', true);

  const result = await createMomentToken({
    ...form.value,
    title,
    description: form.value.subtitle,
    blocks: cleanBlocks(),
  });
  if (result.error) return showMessage(result.error, true);

  const url = `${window.location.origin}/moment?key=${result.token}`;
  showMessage(`纪念瞬间已创建：${url}`);
  resetForm();
  await loadData();
};

const removeMoment = async (item: any) => {
  if (!confirm(`确定删除「${item.title}」？内容集合会保留，但这个 NFC 入口会被移除。`)) return;
  const result = await deleteMomentToken(item.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('纪念瞬间入口已删除');
  await loadData();
};

const copyLink = async (item: any) => {
  const url = `${window.location.origin}/moment?key=${item.token}`;
  await navigator.clipboard.writeText(url);
  showMessage('触碰链接已复制');
};

onMounted(loadData);
</script>

<template>
  <div class="moment-manage">
    <header class="hero">
      <div>
        <p>Moment App</p>
        <h2>纪念瞬间</h2>
        <span>为某个值得保存的场景创建一个可触碰入口。内容进入 Content Collection，应用只负责把“这一刻”组织成体验。</span>
      </div>
      <button @click="loadData">{{ loading ? '同步中...' : '同步列表' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="workspace">
      <article class="panel create-panel">
        <div class="panel-head">
          <span>Creator Flow</span>
          <h3>创建一个纪念页</h3>
          <p>先不用理解平台结构。填写场景、媒介和物品标签，系统会自动完成内容集合、应用绑定和 token 入口。</p>
        </div>

        <div class="form-grid">
          <label><span>标题</span><input v-model="form.title" placeholder="例如：第一次海边旅行" /></label>
          <label><span>物品标签</span><input v-model="form.object_label" placeholder="例如：海边明信片 / 婚礼桌卡" /></label>
          <label><span>日期</span><input v-model="form.event_date" type="date" /></label>
          <label><span>地点</span><input v-model="form.place" placeholder="例如：厦门黄厝海滩" /></label>
          <label><span>封面 URL</span><input v-model="form.cover_url" placeholder="/uploads/..." /></label>
          <label><span>主题色</span><input v-model="form.theme_color" type="color" /></label>
          <label class="full"><span>一句说明</span><textarea v-model="form.subtitle" placeholder="这不是完整复盘，只是想把那天的一点光保存下来。"></textarea></label>
        </div>

        <div class="blocks-editor">
          <div class="blocks-head">
            <h4>纪念媒介</h4>
            <button class="ghost" @click="form.blocks?.push({ kind: 'text', body: '' })">增加内容块</button>
          </div>

          <article v-for="(block, index) in form.blocks" :key="index" class="block-row">
            <select v-model="block.kind">
              <option value="heading">标题</option>
              <option value="text">文字</option>
              <option value="image">图片</option>
              <option value="video">视频</option>
              <option value="audio">音频</option>
              <option value="quote">引用</option>
              <option value="link">链接</option>
            </select>
            <input v-model="block.body" placeholder="文字 / 标题 / 引用" />
            <input v-model="block.url" placeholder="媒体 URL，可选" />
            <input v-model="block.caption" placeholder="说明，可选" />
          </article>
        </div>

        <button class="primary" @click="submit">生成纪念瞬间</button>
      </article>

      <article class="panel side-panel">
        <div class="metric">
          <span>Active Moments</span>
          <strong>{{ activeMoments.length }}</strong>
          <p>每一个纪念瞬间都是一个 token 级轻应用入口。</p>
        </div>
        <div class="note-card">
          <strong>这一页在验证什么？</strong>
          <p>同一个内容容器可以被应用化地创作。创作者看到的是纪念场景，系统得到的是 collection、binding、token 和 object event。</p>
        </div>
      </article>
    </section>

    <section class="list-panel">
      <div class="list-head">
        <h3>已创建的纪念入口</h3>
        <span>{{ moments.length }} items</span>
      </div>

      <div v-if="loading" class="empty">正在加载...</div>
      <div v-else-if="moments.length === 0" class="empty">还没有纪念瞬间。先创建一个小小的时间标本。</div>
      <div v-else class="moment-list">
        <article v-for="item in moments" :key="item.id" class="moment-item">
          <div>
            <span>{{ item.status }} / {{ item.collection_status || 'collection' }}</span>
            <h4>{{ item.title }}</h4>
            <p>{{ item.subtitle || item.collection?.description || '暂无说明' }}</p>
            <small>{{ item.event_date || '未设置日期' }} · {{ item.place || '未设置地点' }} · {{ item.tap_count || 0 }} taps</small>
          </div>
          <div class="item-actions">
            <button @click="copyLink(item)">复制链接</button>
            <a :href="`/moment?key=${item.token}`" target="_blank">预览</a>
            <button class="danger" @click="removeMoment(item)">删除</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.moment-manage {
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
    linear-gradient(135deg, #2f2114, #9a6a2f 58%, #d98fb7);
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
.ghost,
.item-actions button,
.item-actions a {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.hero button,
.ghost,
.item-actions button,
.item-actions a {
  color: #2f2114;
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
.blocks-head h4,
.moment-item h4 {
  margin: 0;
}

.panel-head p,
.note-card p,
.moment-item p {
  color: #756c78;
  line-height: 1.7;
}

.panel-head span,
.metric span {
  color: #9a6a2f;
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
select,
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

.blocks-editor {
  margin-top: 18px;
}

.blocks-head,
.list-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.block-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr);
  gap: 8px;
  margin-bottom: 8px;
}

.primary {
  margin-top: 14px;
  color: #fff;
  background: linear-gradient(135deg, #2f2114, #9a6a2f);
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

.empty {
  padding: 34px;
  color: #9a9090;
  text-align: center;
}

.moment-list {
  display: grid;
  gap: 10px;
}

.moment-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid #efe8e0;
  border-radius: 18px;
  background: #fff;
}

.moment-item span,
.moment-item small,
.list-head span {
  color: #9a9090;
  font-size: 12px;
}

.moment-item h4 {
  margin-top: 4px;
  font-size: 18px;
}

.moment-item p {
  margin: 6px 0;
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: start;
  justify-content: flex-end;
}

.item-actions button,
.item-actions a {
  border: 1px solid #efe8e0;
}

.item-actions .danger {
  color: #c92752;
  background: #fff1f4;
  border-color: #ffd7e1;
}

@media (max-width: 980px) {
  .workspace,
  .form-grid,
  .block-row {
    grid-template-columns: 1fr;
  }

  .hero,
  .moment-item {
    display: grid;
  }

  .item-actions {
    justify-content: flex-start;
  }
}
</style>
