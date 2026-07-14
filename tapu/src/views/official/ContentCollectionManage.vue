<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createAppBinding,
  createContentCollection,
  fetchApplications,
  fetchAppBindings,
  fetchContentCollections,
  type AppBindingInput,
  type ContentCollectionInput,
} from '../../api';

const loading = ref(true);
const collections = ref<any[]>([]);
const bindings = ref<any[]>([]);
const applications = ref<any[]>([]);
const msg = ref('');
const msgError = ref(false);

const collectionForm = ref<ContentCollectionInput>({
  name: '',
  slug: '',
  description: '',
  primary_modality: 'mixed',
  theme_color: '#2f6f5e',
  status: 'published',
  blocks: [
    { kind: 'heading', body: '' },
    { kind: 'text', body: '' },
  ],
});

const bindingForm = ref<AppBindingInput>({
  app_code: 'daily-sticker',
  collection_id: '',
  scope_type: 'app',
  scope_id: '',
  binding_role: 'primary',
  status: 'active',
});

const publishedCollections = computed(() => collections.value.filter(item => item.status === 'published'));
const activeApplications = computed(() => applications.value.filter(item => item.status === 'active'));

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const loadData = async () => {
  loading.value = true;
  const [collectionRows, bindingRows, appRows] = await Promise.all([
    fetchContentCollections({ page: 1, pageSize: 80 }),
    fetchAppBindings(),
    fetchApplications(),
  ]);
  collections.value = Array.isArray(collectionRows.items) ? collectionRows.items : [];
  bindings.value = Array.isArray(bindingRows) ? bindingRows : [];
  applications.value = Array.isArray(appRows) ? appRows : [];
  if (activeApplications.value.length && !activeApplications.value.some(app => app.code === bindingForm.value.app_code)) {
    bindingForm.value.app_code = activeApplications.value[0].code;
  }
  if (!bindingForm.value.collection_id && publishedCollections.value[0]) {
    bindingForm.value.collection_id = publishedCollections.value[0].id;
  }
  loading.value = false;
};

const submitCollection = async () => {
  const blocks = (collectionForm.value.blocks || [])
    .map((block, index) => ({ ...block, sort_order: index }))
    .filter(block => block.kind && (block.body || block.url || block.title || block.action));
  const result = await createContentCollection({ ...collectionForm.value, blocks });
  if (result.error) return showMessage(result.error, true);
  showMessage('内容集合已创建');
  if (result.id) bindingForm.value.collection_id = result.id;
  collectionForm.value = {
    name: '',
    slug: '',
    description: '',
    primary_modality: 'mixed',
    theme_color: '#2f6f5e',
    status: 'published',
    blocks: [
      { kind: 'heading', body: '' },
      { kind: 'text', body: '' },
    ],
  };
  await loadData();
};

const submitBinding = async () => {
  const payload = { ...bindingForm.value };
  if (payload.scope_type === 'app') payload.scope_id = '';
  const result = await createAppBinding(payload);
  if (result.error) return showMessage(result.error, true);
  showMessage('应用绑定已创建');
  await loadData();
};

onMounted(loadData);
</script>

<template>
  <div class="collection-page">
    <header class="creator-hero">
      <div>
        <p>Content Creation Layer</p>
        <h2>内容集合</h2>
        <span>这是创作者中心的最小形态：先把多媒介内容组织成 ContentBlock，再绑定到具体应用或物体作用域。</span>
      </div>
      <button @click="loadData">{{ loading ? '刷新中...' : '刷新' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="creator-grid">
      <article class="panel create-panel">
        <h3>创建内容集合</h3>
        <div class="form-grid">
          <label><span>名称</span><input v-model="collectionForm.name" placeholder="雨天耳机问候" /></label>
          <label><span>Slug</span><input v-model="collectionForm.slug" placeholder="rain-earphone-greeting" /></label>
          <label><span>主媒介</span>
            <select v-model="collectionForm.primary_modality">
              <option value="mixed">mixed</option>
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
            </select>
          </label>
          <label><span>状态</span>
            <select v-model="collectionForm.status">
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label><span>主题色</span><input v-model="collectionForm.theme_color" type="color" /></label>
          <label class="full"><span>描述</span><textarea v-model="collectionForm.description" placeholder="这组内容适合哪个物体，表达什么情绪。"></textarea></label>
        </div>

        <div class="blocks-editor">
          <h4>内容块</h4>
          <article v-for="(block, index) in collectionForm.blocks" :key="index" class="block-row">
            <select v-model="block.kind">
              <option value="heading">heading</option>
              <option value="text">text</option>
              <option value="image">image</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
              <option value="action">action</option>
              <option value="quote">quote</option>
            </select>
            <input v-model="block.body" placeholder="文字内容 / 主句" />
            <input v-model="block.url" placeholder="媒体 URL，可选" />
          </article>
          <button class="ghost" @click="collectionForm.blocks?.push({ kind: 'text', body: '' })">增加内容块</button>
        </div>

        <button class="primary" @click="submitCollection">创建集合</button>
      </article>

      <article class="panel bind-panel">
        <h3>绑定到应用</h3>
        <p>先支持最小作用域：应用默认、某个 token、某个 object。以后第三方应用也走这套绑定逻辑。</p>
        <div class="form-grid">
          <label><span>应用</span>
            <select v-model="bindingForm.app_code">
              <option v-for="app in activeApplications" :key="app.code" :value="app.code">
                {{ app.name }} / {{ app.code }}
              </option>
            </select>
          </label>
          <label><span>集合</span>
            <select v-model="bindingForm.collection_id">
              <option v-for="item in publishedCollections" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <label><span>作用域</span>
            <select v-model="bindingForm.scope_type">
              <option value="app">应用默认</option>
              <option value="token">Token</option>
              <option value="object">Object</option>
            </select>
          </label>
          <label><span>Scope ID</span><input v-model="bindingForm.scope_id" :disabled="bindingForm.scope_type === 'app'" placeholder="token 或 object id" /></label>
        </div>
        <button class="primary" @click="submitBinding">创建绑定</button>
      </article>
    </section>

    <section class="list-grid">
      <article class="panel">
        <h3>内容集合</h3>
        <div class="list">
          <article v-for="item in collections" :key="item.id" class="list-item">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.slug }} / {{ item.status }} / {{ item.primary_modality }}</span>
              <p>{{ item.description || '暂无描述' }}</p>
            </div>
            <small>{{ item.block_count || 0 }} blocks</small>
          </article>
        </div>
      </article>

      <article class="panel">
        <h3>应用绑定</h3>
        <div class="list">
          <article v-for="item in bindings" :key="item.id" class="list-item">
            <div>
              <strong>{{ item.app_code }} / {{ item.binding_role }}</strong>
              <span>{{ item.scope_type }}: {{ item.scope_id || 'app-default' }}</span>
              <p>{{ item.collection_name || item.collection_id }}</p>
            </div>
            <small>{{ item.status }}</small>
          </article>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.collection-page {
  display: grid;
  gap: 16px;
}

.creator-hero,
.panel {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.86);
}

.creator-hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-end;
  padding: 26px;
  border-radius: 26px;
  color: #fff;
  background:
    radial-gradient(circle at 14% 12%, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(135deg, #2f2114, #9a6a2f 58%, #d98fb7);
}

.creator-hero p,
.creator-hero h2,
.creator-hero span {
  margin: 0;
}

.creator-hero p {
  color: #f7dec0;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.creator-hero h2 {
  margin-top: 8px;
  font-size: clamp(28px, 4vw, 40px);
}

.creator-hero span {
  display: block;
  margin-top: 8px;
  max-width: 760px;
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.7;
}

.creator-hero button,
.primary,
.ghost {
  border: 0;
  border-radius: 13px;
  padding: 11px 15px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.creator-hero button,
.ghost {
  background: #fff;
  color: #2f2114;
}

.primary {
  margin-top: 14px;
  color: #fff;
  background: linear-gradient(135deg, #2f2114, #9a6a2f);
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

.creator-grid,
.list-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
  gap: 14px;
}

.panel {
  min-width: 0;
  padding: 18px;
  border-radius: 22px;
}

.panel h3,
.blocks-editor h4 {
  margin: 0 0 14px;
}

.panel p {
  color: #756c78;
  line-height: 1.7;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
  min-height: 96px;
  resize: vertical;
  line-height: 1.7;
}

.blocks-editor {
  margin-top: 16px;
}

.block-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.list {
  display: grid;
  gap: 10px;
}

.list-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 13px;
  border: 1px solid #efe8e0;
  border-radius: 16px;
  background: #fff;
}

.list-item span,
.list-item small {
  color: #9a9090;
  font-size: 12px;
}

.list-item p {
  margin: 6px 0 0;
  font-size: 13px;
}

@media (max-width: 980px) {
  .creator-grid,
  .list-grid,
  .form-grid,
  .block-row {
    grid-template-columns: 1fr;
  }

  .creator-hero,
  .list-item {
    display: grid;
  }
}
</style>
