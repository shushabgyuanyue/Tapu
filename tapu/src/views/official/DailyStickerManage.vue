<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createDailyStickerEntry,
  createDailyStickerTokens,
  deleteDailyStickerEntry,
  deleteDailyStickerToken,
  fetchDailyStickerEntries,
  fetchDailyStickerPersonas,
  fetchDailyStickerSettings,
  fetchDailyStickerStoryArcs,
  fetchDailyStickerTokens,
  fetchDailyStickerVisualStyles,
  fetchDailyStickerWorlds,
  updateDailyStickerEntry,
  updateDailyStickerSettings,
  updateDailyStickerStoryArc,
} from '../../api';

const DEMO_TOKEN = '9f1d7a4e6b8c4f21a3d5e7c9b0a2f416';

const loading = ref(false);
const activePanel = ref<'story' | 'content' | 'tokens' | 'settings'>('story');
const personas = ref<any[]>([]);
const worlds = ref<any[]>([]);
const storyArcs = ref<any[]>([]);
const entries = ref<any[]>([]);
const tokens = ref<any[]>([]);
const visualStyles = ref<any[]>([]);
const settings = ref({ release_cron: '*/1 * * * *', release_timezone: 'Asia/Shanghai' });
const activeStoryArcId = ref('');
const selectedDay = ref(1);
const msg = ref('');
const msgError = ref(false);

const entryEditingId = ref('');
const entryForm = ref({
  persona_id: '',
  world_id: '',
  story_arc_id: '',
  day_index: 1,
  entry_date: new Date().toISOString().slice(0, 10),
  title: '',
  body: '',
  image_url: '',
  mood: '',
  visual_style_code: 'modern-life-aesthetic',
  template_code: 'story-card',
  motion_preset: 'float',
  status: 'published',
});

const tokenForm = ref({
  persona_id: '',
  world_id: '',
  story_arc_id: '',
  label: '',
  count: 1,
  progress_mode: 'story_day',
  story_start_date: '',
  day_offset: 0,
  status: 'active',
});

const activeStoryArc = computed(() => storyArcs.value.find(item => item.id === activeStoryArcId.value) || storyArcs.value[0] || null);
const activeWorld = computed(() => worlds.value.find(item => item.id === activeStoryArc.value?.world_id) || worlds.value[0] || null);
const activePersona = computed(() => personas.value.find(item => item.id === activeWorld.value?.persona_id) || personas.value[0] || null);
const storyEntries = computed(() => entries.value
  .filter(item => !activeStoryArc.value || item.story_arc_id === activeStoryArc.value.id)
  .sort((a, b) => Number(a.day_index || 0) - Number(b.day_index || 0)));
const selectedEntry = computed(() => storyEntries.value.find(item => Number(item.day_index) === selectedDay.value) || storyEntries.value[0] || null);
const demoToken = computed(() => tokens.value.find(item => item.token === DEMO_TOKEN)?.token || tokens.value[0]?.token || DEMO_TOKEN);
const previewUrl = computed(() => `${window.location.origin}/sticker?key=${encodeURIComponent(demoToken.value)}&day=${selectedDay.value}`);
const nfcUrl = computed(() => `${window.location.origin}/sticker?key=${encodeURIComponent(demoToken.value)}`);

const panelTabs = [
  { key: 'story', label: '故事预览', hint: '看完整 30 天节奏' },
  { key: 'content', label: '内容库', hint: '编辑每天内容' },
  { key: 'tokens', label: 'Token / NFC', hint: '生成贴纸入口' },
  { key: 'settings', label: '发布设置', hint: '设置 cron 节奏' },
] as const;

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const hydrateForms = () => {
  if (!activeStoryArc.value || !activeWorld.value || !activePersona.value) return;
  entryForm.value.persona_id = activePersona.value.id;
  entryForm.value.world_id = activeWorld.value.id;
  entryForm.value.story_arc_id = activeStoryArc.value.id;
  tokenForm.value.persona_id = activePersona.value.id;
  tokenForm.value.world_id = activeWorld.value.id;
  tokenForm.value.story_arc_id = activeStoryArc.value.id;
  tokenForm.value.story_start_date = activeStoryArc.value.starts_on || '';
};

const loadAll = async () => {
  loading.value = true;
  const [personaRows, worldRows, arcRows, entryRows, tokenRows, styleRows, settingRows] = await Promise.all([
    fetchDailyStickerPersonas(),
    fetchDailyStickerWorlds(),
    fetchDailyStickerStoryArcs(),
    fetchDailyStickerEntries(),
    fetchDailyStickerTokens({ page: 1, pageSize: 100 }),
    fetchDailyStickerVisualStyles(),
    fetchDailyStickerSettings(),
  ]);

  personas.value = Array.isArray(personaRows) ? personaRows : [];
  worlds.value = Array.isArray(worldRows) ? worldRows : [];
  storyArcs.value = Array.isArray(arcRows) ? arcRows : [];
  entries.value = Array.isArray(entryRows) ? entryRows : [];
  tokens.value = Array.isArray(tokenRows.items) ? tokenRows.items : Array.isArray(tokenRows) ? tokenRows : [];
  visualStyles.value = Array.isArray(styleRows) ? styleRows : [];
  if (settingRows && !settingRows.error) {
    settings.value = {
      release_cron: settingRows.release_cron || '*/1 * * * *',
      release_timezone: settingRows.release_timezone || 'Asia/Shanghai',
    };
  }
  if (!activeStoryArcId.value && storyArcs.value[0]) activeStoryArcId.value = storyArcs.value[0].id;
  hydrateForms();
  loading.value = false;
};

const chooseStoryArc = () => {
  selectedDay.value = 1;
  hydrateForms();
};

const editEntry = (entry: any) => {
  entryEditingId.value = entry.id;
  entryForm.value = {
    persona_id: entry.persona_id || activePersona.value?.id || '',
    world_id: entry.world_id || activeWorld.value?.id || '',
    story_arc_id: entry.story_arc_id || activeStoryArc.value?.id || '',
    day_index: Number(entry.day_index || 1),
    entry_date: entry.entry_date || new Date().toISOString().slice(0, 10),
    title: entry.title || '',
    body: entry.body || '',
    image_url: entry.image_url || '',
    mood: entry.mood || '',
    visual_style_code: entry.visual_style_code || 'modern-life-aesthetic',
    template_code: entry.template_code || 'story-card',
    motion_preset: entry.motion_preset || 'float',
    status: entry.status || 'published',
  };
  activePanel.value = 'content';
};

const resetEntryForm = () => {
  entryEditingId.value = '';
  const nextDay = Math.min((storyEntries.value.length || 0) + 1, 30);
  entryForm.value = {
    persona_id: activePersona.value?.id || '',
    world_id: activeWorld.value?.id || '',
    story_arc_id: activeStoryArc.value?.id || '',
    day_index: nextDay,
    entry_date: activeStoryArc.value?.starts_on || new Date().toISOString().slice(0, 10),
    title: '',
    body: '',
    image_url: activeWorld.value?.cover_url || '',
    mood: '',
    visual_style_code: 'modern-life-aesthetic',
    template_code: 'story-card',
    motion_preset: 'float',
    status: 'published',
  };
};

const submitEntry = async () => {
  const payload = {
    ...entryForm.value,
    day_index: Number(entryForm.value.day_index) || undefined,
    body: entryForm.value.body.trim(),
    title: entryForm.value.title.trim(),
    assets: entryForm.value.image_url
      ? [{ asset_type: 'image', role: 'cover', url: entryForm.value.image_url, alt_text: entryForm.value.title }]
      : [],
  };
  if (!payload.persona_id || !payload.entry_date || !payload.title) {
    return showMessage('请填写人格、日期和标题', true);
  }
  const result = entryEditingId.value
    ? await updateDailyStickerEntry(entryEditingId.value, payload)
    : await createDailyStickerEntry(payload);
  if (result.error) return showMessage(result.error, true);
  showMessage(entryEditingId.value ? '内容已更新' : '内容已创建');
  resetEntryForm();
  await loadAll();
};

const removeEntry = async (entry: any) => {
  if (!confirm(`删除 Day ${entry.day_index}「${entry.title}」？`)) return;
  const result = await deleteDailyStickerEntry(entry.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('内容已删除');
  await loadAll();
};

const saveStorySchedule = async () => {
  if (!activeStoryArc.value) return;
  const result = await updateDailyStickerStoryArc(activeStoryArc.value.id, {
    world_id: activeStoryArc.value.world_id,
    title: activeStoryArc.value.title,
    summary: activeStoryArc.value.summary,
    source_format: activeStoryArc.value.source_format || 'markdown',
    markdown_source: activeStoryArc.value.markdown_source,
    total_days: Number(activeStoryArc.value.total_days || 30),
    starts_on: activeStoryArc.value.starts_on,
    release_cron: activeStoryArc.value.release_cron || settings.value.release_cron,
    release_timezone: activeStoryArc.value.release_timezone || settings.value.release_timezone,
    status: activeStoryArc.value.status || 'published',
  });
  if (result.error) return showMessage(result.error, true);
  showMessage('故事发布节奏已保存');
  await loadAll();
};

const saveGlobalSettings = async () => {
  const result = await updateDailyStickerSettings(settings.value);
  if (result.error) return showMessage(result.error, true);
  showMessage('全局发布设置已保存');
  await loadAll();
};

const createToken = async () => {
  const result = await createDailyStickerTokens({
    ...tokenForm.value,
    count: Number(tokenForm.value.count) || 1,
    day_offset: Number(tokenForm.value.day_offset) || 0,
  });
  if (result.error) return showMessage(result.error, true);
  showMessage(`已生成 ${result.tokens?.length || 1} 个 NFC token`);
  await loadAll();
};

const removeToken = async (token: any) => {
  if (!confirm(`删除 token「${token.label || token.token}」？`)) return;
  const result = await deleteDailyStickerToken(token.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('token 已删除');
  await loadAll();
};

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
  showMessage('链接已复制');
};

onMounted(loadAll);
</script>

<template>
  <div class="dsm">
    <header class="hero">
      <div>
        <p>Daily Sticker Application</p>
        <h2>日常贴纸运营台</h2>
        <span>管理连续小世界、30 天故事、NFC token 和发布节奏。演示故事已内置：喜欢茉莉花和雨天的耳机小姐。</span>
      </div>
      <button class="hero-btn" @click="loadAll">{{ loading ? '刷新中...' : '刷新数据' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <nav class="panel-tabs">
      <button
        v-for="tab in panelTabs"
        :key="tab.key"
        :class="{ active: activePanel === tab.key }"
        @click="activePanel = tab.key"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.hint }}</span>
      </button>
    </nav>

    <section v-if="activePanel === 'story'" class="story-layout">
      <article class="panel side-panel">
        <h3>小世界</h3>
        <label>
          <span>故事线</span>
          <select v-model="activeStoryArcId" @change="chooseStoryArc">
            <option v-for="arc in storyArcs" :key="arc.id" :value="arc.id">{{ arc.title }}</option>
          </select>
        </label>
        <div v-if="activeWorld" class="world-card">
          <img v-if="activeWorld.cover_url" :src="activeWorld.cover_url" alt="小世界封面" />
          <strong>{{ activeWorld.name }}</strong>
          <p>{{ activeWorld.premise }}</p>
          <small>{{ activeWorld.atmosphere }}</small>
        </div>
        <div v-if="activeStoryArc" class="meta-list">
          <span>共 {{ activeStoryArc.total_days || 30 }} 天</span>
          <span>起始日 {{ activeStoryArc.starts_on || '未设置' }}</span>
          <span>发布 cron {{ activeStoryArc.release_cron || settings.release_cron }}</span>
        </div>
      </article>

      <article class="panel preview-panel">
        <div class="preview-head">
          <div>
            <h3>{{ activeStoryArc?.title || '故事预览' }}</h3>
            <p>{{ activeStoryArc?.summary }}</p>
          </div>
          <div class="preview-actions">
            <button @click="copyText(nfcUrl)">复制 NFC 链接</button>
            <a :href="previewUrl" target="_blank" rel="noreferrer">打开 Day {{ selectedDay }}</a>
          </div>
        </div>
        <div class="day-strip">
          <button
            v-for="entry in storyEntries"
            :key="entry.id"
            :class="{ active: Number(entry.day_index) === selectedDay }"
            @click="selectedDay = Number(entry.day_index)"
          >{{ entry.day_index }}</button>
        </div>
        <div v-if="selectedEntry" class="day-preview">
          <img v-if="selectedEntry.image_url" :src="selectedEntry.image_url" alt="每日插图" />
          <div>
            <span>Day {{ selectedEntry.day_index }} · {{ selectedEntry.mood || '日常' }}</span>
            <h2>{{ selectedEntry.title }}</h2>
            <p>{{ selectedEntry.body }}</p>
            <button @click="editEntry(selectedEntry)">编辑这一天</button>
          </div>
        </div>
      </article>
    </section>

    <section v-if="activePanel === 'content'" class="content-layout">
      <article class="panel form-panel">
        <h3>{{ entryEditingId ? '编辑一天' : '新增一天' }}</h3>
        <div class="form-grid">
          <label><span>Day</span><input v-model.number="entryForm.day_index" type="number" min="1" max="365" /></label>
          <label><span>日期</span><input v-model="entryForm.entry_date" type="date" /></label>
          <label><span>标题</span><input v-model="entryForm.title" placeholder="雨声调试" /></label>
          <label><span>情绪</span><input v-model="entryForm.mood" placeholder="安静 / 留白 / 通勤" /></label>
          <label>
            <span>视觉风格</span>
            <select v-model="entryForm.visual_style_code">
              <option v-for="style in visualStyles" :key="style.code" :value="style.code">{{ style.name }}</option>
            </select>
          </label>
          <label>
            <span>动效</span>
            <select v-model="entryForm.motion_preset">
              <option value="float">float</option>
              <option value="glow">glow</option>
              <option value="none">none</option>
            </select>
          </label>
          <label class="full"><span>正文</span><textarea v-model="entryForm.body" placeholder="今天耳机小姐听见..."></textarea></label>
          <label class="full"><span>图片 URL</span><input v-model="entryForm.image_url" placeholder="/daily-stickers/jasmine-rain-cover.svg" /></label>
        </div>
        <div class="actions">
          <button class="primary" @click="submitEntry">{{ entryEditingId ? '保存' : '创建' }}</button>
          <button class="ghost" @click="resetEntryForm">清空</button>
        </div>
      </article>

      <article class="panel list-panel">
        <h3>30 天内容</h3>
        <div class="entry-list">
          <article v-for="entry in storyEntries" :key="entry.id" class="entry-item">
            <div>
              <strong>Day {{ entry.day_index }} · {{ entry.title }}</strong>
              <span>{{ entry.entry_date }} · {{ entry.visual_style_code }} · {{ entry.status }}</span>
              <p>{{ entry.body }}</p>
            </div>
            <div class="row-actions">
              <button @click="editEntry(entry)">编辑</button>
              <button class="danger" @click="removeEntry(entry)">删除</button>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section v-if="activePanel === 'tokens'" class="panel token-panel">
      <div class="token-head">
        <div>
          <h3>NFC Token</h3>
          <p>演示链接：<code>{{ nfcUrl }}</code></p>
        </div>
        <button @click="copyText(nfcUrl)">复制演示 NFC 链接</button>
      </div>
      <div class="token-form">
        <label><span>标签</span><input v-model="tokenForm.label" placeholder="耳机小姐-第一批" /></label>
        <label><span>数量</span><input v-model.number="tokenForm.count" type="number" min="1" max="100" /></label>
        <label>
          <span>进度方式</span>
          <select v-model="tokenForm.progress_mode">
            <option value="story_day">按故事天数</option>
            <option value="calendar_day">按日期</option>
          </select>
        </label>
        <label><span>故事开始日</span><input v-model="tokenForm.story_start_date" type="date" /></label>
        <label><span>偏移天数</span><input v-model.number="tokenForm.day_offset" type="number" /></label>
      </div>
      <div class="actions"><button class="primary" @click="createToken">生成 token</button></div>
      <div class="token-list">
        <article v-for="item in tokens" :key="item.id" class="token-item">
          <div>
            <strong>{{ item.label || item.persona_name }}</strong>
            <code>{{ item.token }}</code>
            <span>{{ item.story_arc_title || '未绑定故事' }} · {{ item.progress_mode }} · {{ item.status }}</span>
            <span v-if="item.owner_username">已归属：{{ item.owner_username }}</span>
          </div>
          <div class="row-actions">
            <button @click="copyText(`${window.location.origin}/sticker?key=${encodeURIComponent(item.token)}`)">复制</button>
            <button class="danger" @click="removeToken(item)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="activePanel === 'settings'" class="settings-grid">
      <article class="panel">
        <h3>全局发布设置</h3>
        <p class="hint">支持分钟级测试 cron，例如 `*/1 * * * *` 表示每 1 分钟切换；生产可用日级 cron，例如 `0 8 * * *`。</p>
        <div class="form-grid">
          <label><span>默认 cron</span><input v-model="settings.release_cron" placeholder="*/1 * * * *" /></label>
          <label><span>默认时区</span><input v-model="settings.release_timezone" placeholder="Asia/Shanghai" /></label>
        </div>
        <div class="actions"><button class="primary" @click="saveGlobalSettings">保存全局设置</button></div>
      </article>

      <article class="panel" v-if="activeStoryArc">
        <h3>当前故事发布设置</h3>
        <div class="form-grid">
          <label><span>起始日</span><input v-model="activeStoryArc.starts_on" type="date" /></label>
          <label><span>故事 cron</span><input v-model="activeStoryArc.release_cron" placeholder="*/1 * * * *" /></label>
          <label><span>时区</span><input v-model="activeStoryArc.release_timezone" placeholder="Asia/Shanghai" /></label>
          <label>
            <span>状态</span>
            <select v-model="activeStoryArc.status">
              <option value="published">published</option>
              <option value="draft">draft</option>
              <option value="paused">paused</option>
            </select>
          </label>
        </div>
        <div class="actions"><button class="primary" @click="saveStorySchedule">保存故事设置</button></div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.dsm {
  display: grid;
  gap: 16px;
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 18% 10%, rgba(255, 163, 218, 0.35), transparent 30%),
    radial-gradient(circle at 86% 16%, rgba(145, 169, 184, 0.28), transparent 32%),
    linear-gradient(135deg, #140b18, #2a1733 58%, #0b0710);
}

.hero p,
.hero h2,
.hero span {
  margin: 0;
}

.hero p {
  color: #ffd4ef;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.hero h2 {
  margin-top: 8px;
  font-size: clamp(24px, 4vw, 32px);
  letter-spacing: -0.04em;
}

.hero span {
  display: block;
  margin-top: 8px;
  max-width: 720px;
  color: rgba(255,255,255,.72);
  line-height: 1.7;
}

.hero-btn,
.panel-tabs button,
.primary,
.ghost,
.preview-actions button,
.preview-actions a,
.token-head button,
.row-actions button,
.day-preview button {
  border: 0;
  border-radius: 12px;
  padding: 9px 13px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.hero-btn,
.primary {
  background: linear-gradient(135deg, #ff4fd8, #7c4dff);
  color: #fff;
}

.ghost,
.preview-actions button,
.preview-actions a,
.token-head button,
.row-actions button,
.day-preview button {
  border: 1px solid #eee;
  background: #fff;
  color: #5b5360;
}

.danger {
  color: #d9305f !important;
  border-color: #ffd5df !important;
}

.msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #eefaf2;
  color: #16803a;
  font-size: 13px;
}

.msg.error {
  background: #fff1f4;
  color: #c92752;
}

.panel-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.panel-tabs button {
  display: grid;
  gap: 4px;
  min-width: 0;
  border: 1px solid #f0edf5;
  background: #fff;
  color: #6a6170;
  text-align: left;
}

.panel-tabs button span {
  color: #9a90a0;
  font-size: 11px;
  line-height: 1.35;
}

.panel-tabs button.active {
  color: #251229;
  background: #fff3fb;
  border-color: #ffc7ef;
}

.story-layout,
.content-layout,
.settings-grid {
  display: grid;
  grid-template-columns: minmax(260px, .82fr) minmax(0, 1.18fr);
  gap: 18px;
}

.panel {
  min-width: 0;
  padding: 18px;
  border: 1px solid #f0edf5;
  border-radius: 20px;
  background: #fff;
}

.panel h3 {
  margin: 0 0 14px;
  font-size: 18px;
}

label {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #655b6b;
  font-size: 12px;
  font-weight: 800;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #e9e5ef;
  border-radius: 12px;
  padding: 10px 11px;
  color: #211628;
  outline: none;
}

textarea {
  min-height: 170px;
  resize: vertical;
  line-height: 1.7;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #ff4fd8;
  box-shadow: 0 0 0 3px rgba(255,79,216,.1);
}

.world-card {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 16px;
  background: #faf7f5;
}

.world-card img {
  width: 100%;
  border-radius: 14px;
  display: block;
}

.world-card p,
.preview-head p,
.hint {
  margin: 0;
  color: #817888;
  line-height: 1.7;
  font-size: 13px;
}

.world-card small,
.meta-list span,
.entry-item span,
.token-item span {
  color: #9a90a0;
  font-size: 12px;
  line-height: 1.6;
}

.meta-list {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.preview-head,
.token-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.preview-head h3 {
  margin-bottom: 6px;
}

.preview-actions,
.actions,
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.day-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 14px 0;
  scroll-snap-type: x proximity;
}

.day-strip button {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid #eee;
  background: #fff;
  cursor: pointer;
  scroll-snap-align: start;
}

.day-strip button.active {
  background: #24112a;
  color: #fff;
  border-color: #24112a;
}

.day-preview {
  display: grid;
  grid-template-columns: minmax(180px, .72fr) minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 14px;
  border-radius: 18px;
  background: #fbf8f6;
}

.day-preview img {
  width: 100%;
  border-radius: 18px;
  display: block;
}

.day-preview span {
  color: #d98fb7;
  font-size: 13px;
  font-weight: 900;
}

.day-preview h2 {
  margin: 8px 0;
  font-size: 28px;
}

.day-preview p {
  color: #4f4554;
  line-height: 1.9;
  white-space: pre-wrap;
}

.form-grid,
.token-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}

.token-form {
  grid-template-columns: repeat(5, minmax(0,1fr));
}

.full {
  grid-column: 1 / -1;
}

.actions {
  margin-top: 14px;
}

.entry-list,
.token-list {
  display: grid;
  gap: 10px;
  max-height: 720px;
  overflow: auto;
  padding-right: 4px;
}

.entry-item,
.token-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 13px;
  border: 1px solid #f0edf5;
  border-radius: 15px;
}

.entry-item > div:first-child,
.token-item > div:first-child {
  min-width: 0;
}

.entry-item p {
  display: -webkit-box;
  margin: 7px 0 0;
  overflow: hidden;
  color: #5d5366;
  font-size: 13px;
  line-height: 1.6;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.token-head code,
.token-item code {
  color: #7c4dff;
  font-size: 11px;
  word-break: break-all;
}

.token-item code {
  display: block;
  margin: 5px 0;
}

@media (max-width: 980px) {
  .story-layout,
  .content-layout,
  .settings-grid,
  .form-grid,
  .token-form {
    grid-template-columns: 1fr;
  }

  .panel-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero,
  .preview-head,
  .token-head,
  .entry-item,
  .token-item {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }

  .day-preview {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .dsm {
    gap: 12px;
  }

  .hero,
  .panel {
    border-radius: 18px;
  }

  .hero {
    padding: 18px;
  }

  .hero-btn,
  .primary,
  .ghost,
  .token-head button,
  .preview-actions button,
  .preview-actions a,
  .row-actions button,
  .day-preview button {
    width: 100%;
    min-height: 42px;
  }

  .panel-tabs {
    display: flex;
    overflow-x: auto;
    padding-bottom: 2px;
    scroll-snap-type: x proximity;
  }

  .panel-tabs button {
    flex: 0 0 72%;
    scroll-snap-align: start;
  }

  .preview-actions,
  .actions,
  .row-actions {
    display: grid;
    grid-template-columns: 1fr;
  }

  .entry-list,
  .token-list {
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .entry-item,
  .token-item {
    display: grid;
  }

  .day-preview {
    padding: 12px;
  }

  .day-preview h2 {
    font-size: 22px;
  }

  .day-preview p {
    font-size: 14px;
    line-height: 1.8;
  }

  textarea {
    min-height: 140px;
  }
}
</style>
