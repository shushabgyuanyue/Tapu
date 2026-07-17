<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchContentInstance,
  isLoggedIn,
  setIpInstanceContentByToken,
  setOfficialDefaultContent,
} from '../api';
import ContentRenderer from '../components/content/ContentRenderer.vue';
import NavBar from '../components/NavBar.vue';
import { contentCopy } from '../copy';
import { AUTH_CHANGED_EVENT, CONTENT_CHANGED_EVENT, emitContentChanged } from '../events/appEvents';

const route = useRoute();
const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const content = ref<any>(null);
const loading = ref(true);
const failed = ref(false);
const tokenKey = ref('');
const tokenBinding = ref(false);
const tokenBindMsg = ref('');
const tokenBindError = ref(false);
const officialBinding = ref(false);
const officialBindMsg = ref('');
const officialBindError = ref(false);
const officialDefaultSet = ref(false);

const formatContentId = (id?: string) => id ? id.replace(/-/g, '').toUpperCase() : '-';

const blocks = computed(() => Array.isArray(content.value?.blocks) ? content.value.blocks : []);
const canBindToEntity = computed(() => !!content.value?.ip_definition_id);
const canEditContent = computed(() => !!content.value?.viewer_can_edit);
const canSetOfficialDefault = computed(() => !!content.value?.viewer_can_set_official_default);
const draftVersions = computed(() => Array.isArray(content.value?.draft_versions) ? content.value.draft_versions : []);
const themeColor = computed(() => (
  content.value?.payload?.themeColor
  || content.value?.payload?.theme_color
  || '#2f6f5e'
));

async function loadContent() {
  loading.value = true;
  failed.value = false;
  const id = route.params.id as string;
  const result = await fetchContentInstance(id);
  if (result?.error) {
    failed.value = true;
    content.value = null;
  } else {
    content.value = result;
  }
  loading.value = false;
}

function handleRuntimeContentChange(event: Event) {
  const changedId = (event as CustomEvent<{ contentId?: string }>).detail?.contentId;
  if (!changedId || changedId === content.value?.id || changedId === route.params.id) {
    loadContent();
  }
}

onMounted(() => {
  loadContent();
  window.addEventListener(AUTH_CHANGED_EVENT, loadContent);
  window.addEventListener(CONTENT_CHANGED_EVENT, handleRuntimeContentChange);
  window.addEventListener('focus', loadContent);
});

onUnmounted(() => {
  window.removeEventListener(AUTH_CHANGED_EVENT, loadContent);
  window.removeEventListener(CONTENT_CHANGED_EVENT, handleRuntimeContentChange);
  window.removeEventListener('focus', loadContent);
});

const copyContentId = async () => {
  if (!content.value?.id) return;
  await navigator.clipboard.writeText(formatContentId(content.value.id));
  toast?.show(contentCopy.detail.toasts.contentIdCopied, 1800, 'success');
};

const sharePreview = async () => {
  if (!content.value?.id) return;
  const url = `${window.location.origin}/content/${content.value.id}`;
  if (navigator.share) {
    await navigator.share({ title: content.value.title, url });
  } else {
    await navigator.clipboard.writeText(url);
    toast?.show(contentCopy.detail.toasts.previewCopied, 1800, 'success');
  }
};

const handleBindEntity = () => {
  if (!content.value?.id) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.bindLogin, 3200, 'error');
  }
  router.push({ path: '/assets', query: { defaultContentId: content.value.id } });
};

const openContentAuthoring = (mode: 'revise' | 'extend') => {
  if (!content.value?.id) return;
  if (!isLoggedIn()) {
    toast?.show(contentCopy.detail.toasts.editLogin, 2400, 'error');
    return;
  }
  router.push({ path: '/mint', query: { content_id: content.value.id, mode } });
};

const bindCurrentContentToToken = async () => {
  if (!content.value?.id) return;
  tokenBindMsg.value = '';
  tokenBindError.value = false;

  const key = tokenKey.value.trim();
  if (!key) {
    tokenBindMsg.value = contentCopy.detail.tokenBind.empty;
    tokenBindError.value = true;
    return;
  }

  tokenBinding.value = true;
  const result = await setIpInstanceContentByToken(key, content.value.id);
  tokenBinding.value = false;

  if (result?.success) {
    tokenBindMsg.value = contentCopy.detail.tokenBind.success;
    tokenKey.value = '';
    emitContentChanged('bound', content.value.id);
    toast?.show(contentCopy.detail.toasts.defaultUpdated, 2200, 'success');
  } else {
    tokenBindMsg.value = result?.error || contentCopy.detail.tokenBind.failed;
    tokenBindError.value = true;
  }
};

const bindAsOfficialDefault = async () => {
  if (!content.value?.id || !content.value?.ip_definition_id) return;
  officialBindMsg.value = '';
  officialBindError.value = false;
  officialBinding.value = true;

  const result = await setOfficialDefaultContent(content.value.ip_definition_id, content.value.id);

  officialBinding.value = false;
  if (result?.success) {
    officialDefaultSet.value = true;
    officialBindMsg.value = contentCopy.detail.officialDefault.successHint;
    emitContentChanged('bound', content.value.id);
    toast?.show(contentCopy.detail.officialDefault.successToast, 2200, 'success');
    return;
  }

  officialBindMsg.value = result?.error || contentCopy.detail.officialDefault.failed;
  officialBindError.value = true;
};

const goBack = () => {
  router.back();
};
</script>

<template>
  <div class="detail-page">
    <NavBar />

    <main v-if="!loading && content" class="detail-shell">
      <section class="hero">
        <div class="hero-copy">
          <p class="hero-kicker">{{ content.application_name || content.content_definition_name || 'Content' }}</p>
          <h1>{{ content.title || 'Content' }}</h1>
          <p v-if="content.summary" class="hero-summary">{{ content.summary }}</p>
        </div>
        <div class="hero-meta">
          <span>{{ content.content_kind || 'mixed' }}</span>
          <span>{{ content.status || 'draft' }}</span>
          <span>{{ contentCopy.detail.versions.current(content.version_no || 1) }}</span>
          <button class="detail-id" @click="copyContentId">
            {{ contentCopy.detail.meta.id(formatContentId(content.id)) }}
          </button>
        </div>
        <p v-if="canEditContent" class="version-hint">
          {{
            draftVersions.length
              ? contentCopy.detail.versions.draftCount(draftVersions.length)
              : contentCopy.detail.versions.editHint
          }}
        </p>
      </section>

      <section class="content-card">
        <ContentRenderer
          :blocks="blocks"
          :context="{ surface: 'detail', themeColor, appCode: content.application_code, controls: true }"
        />
        <p v-if="blocks.length === 0" class="empty">{{ contentCopy.detail.states.emptyRenderable }}</p>
      </section>

      <section class="detail-actions">
        <button class="act-btn" @click="sharePreview">
          <span>{{ contentCopy.detail.actions.sharePreview }}</span>
        </button>

        <button v-if="canBindToEntity" class="act-btn act-btn-bind" @click="handleBindEntity">
          <span>{{ contentCopy.detail.actions.bindEntity }}</span>
        </button>

        <button v-if="canEditContent" class="act-btn act-btn-revise" @click="openContentAuthoring('revise')">
          <span>{{ contentCopy.detail.actions.revise }}</span>
        </button>

        <button v-if="canEditContent" class="act-btn act-btn-extend" @click="openContentAuthoring('extend')">
          <span>{{ contentCopy.detail.actions.extend }}</span>
        </button>

        <button
          v-if="canSetOfficialDefault"
          class="act-btn act-btn-official"
          :disabled="officialBinding || officialDefaultSet"
          @click="bindAsOfficialDefault"
        >
          <span>
            {{
              officialBinding
                ? contentCopy.detail.officialDefault.setting
                : (officialDefaultSet ? contentCopy.detail.officialDefault.setDone : contentCopy.detail.officialDefault.set)
            }}
          </span>
        </button>
      </section>

      <p v-if="canBindToEntity" class="detail-action-hint">{{ contentCopy.detail.actions.bindHint }}</p>
      <p
        v-if="canSetOfficialDefault && officialBindMsg"
        :class="['detail-action-hint', { 'detail-action-hint--error': officialBindError }]"
      >
        {{ officialBindMsg }}
      </p>

      <section v-if="canBindToEntity" class="token-bind-panel">
        <div>
          <span class="token-bind-kicker">{{ contentCopy.detail.tokenBind.kicker }}</span>
          <h2>{{ contentCopy.detail.tokenBind.title }}</h2>
          <p>{{ contentCopy.detail.tokenBind.body }}</p>
        </div>
        <div class="token-bind-box">
          <input v-model="tokenKey" :placeholder="contentCopy.detail.tokenBind.placeholder" />
          <button :disabled="tokenBinding" @click="bindCurrentContentToToken">
            {{ tokenBinding ? contentCopy.detail.tokenBind.writing : contentCopy.detail.tokenBind.write }}
          </button>
        </div>
        <p v-if="tokenBindMsg" :class="['token-bind-msg', { error: tokenBindError }]">{{ tokenBindMsg }}</p>
      </section>

      <button class="back-btn" @click="goBack">{{ contentCopy.detail.actions.back }}</button>
    </main>

    <div v-else-if="loading" class="detail-loading">
      <div class="spinner"></div>
    </div>

    <main v-else class="detail-shell">
      <section class="error-card">
        <h1>{{ contentCopy.detail.error.title }}</h1>
        <p>{{ contentCopy.detail.error.hint }}</p>
        <button class="back-btn" @click="goBack">{{ contentCopy.detail.error.back }}</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 16% 10%, rgba(217, 143, 183, 0.16), transparent 30%),
    radial-gradient(circle at 84% 18%, rgba(47, 111, 94, 0.16), transparent 26%),
    linear-gradient(180deg, #f7f0e8 0%, #fffdf8 48%, #ffffff 100%);
}

.detail-shell {
  width: min(920px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 28px 0 48px;
  display: grid;
  gap: 18px;
}

.hero,
.content-card,
.token-bind-panel,
.error-card {
  border: 1px solid rgba(32, 27, 34, 0.08);
  background: rgba(255, 255, 255, 0.88);
  border-radius: 28px;
  box-shadow: 0 18px 40px rgba(32, 27, 34, 0.06);
}

.hero {
  display: grid;
  gap: 16px;
  padding: 28px;
}

.hero-kicker {
  margin: 0;
  color: #8d5b3b;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1 {
  margin: 6px 0 0;
  color: #241814;
  font-size: clamp(32px, 6vw, 52px);
  line-height: 1.08;
  font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
}

.hero-summary {
  margin: 12px 0 0;
  max-width: 720px;
  color: rgba(36, 24, 20, 0.76);
  font-size: 16px;
  line-height: 1.85;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.hero-meta span,
.detail-id {
  border-radius: 999px;
  padding: 8px 12px;
  background: rgba(47, 111, 94, 0.08);
  color: #2f6f5e;
  font-size: 12px;
  font-weight: 800;
}

.detail-id {
  border: 0;
  cursor: pointer;
}

.content-card {
  padding: 24px;
}

.empty {
  margin: 0;
  color: rgba(36, 24, 20, 0.56);
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.act-btn,
.token-bind-box button,
.back-btn {
  border: 0;
  border-radius: 14px;
  padding: 12px 16px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.act-btn,
.back-btn {
  background: #241814;
  color: #fff;
}

.act-btn-bind {
  background: linear-gradient(135deg, #2f6f5e, #4c9a81);
}

.act-btn-official {
  background: linear-gradient(135deg, #8d5b3b, #c48a52);
}

.act-btn-revise {
  background: linear-gradient(135deg, #4b5f8f, #7b8fc1);
}

.act-btn-extend {
  background: linear-gradient(135deg, #9a6a2f, #d1a36a);
}

.act-btn:disabled {
  opacity: 0.7;
  cursor: default;
}

.version-hint {
  margin: 2px 0 0;
  color: rgba(36, 24, 20, 0.6);
  font-size: 13px;
  line-height: 1.7;
}

.detail-action-hint {
  margin: -4px 0 0;
  color: rgba(36, 24, 20, 0.58);
  font-size: 13px;
}

.detail-action-hint--error {
  color: #c0395f;
}

.token-bind-panel {
  display: grid;
  gap: 14px;
  padding: 22px 24px;
}

.token-bind-kicker {
  color: #2f6f5e;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.token-bind-panel h2 {
  margin: 6px 0 0;
  color: #241814;
  font-size: 22px;
}

.token-bind-panel p {
  margin: 8px 0 0;
  color: rgba(36, 24, 20, 0.72);
  line-height: 1.75;
}

.token-bind-box {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.token-bind-box input {
  min-width: 0;
  border: 1px solid rgba(36, 24, 20, 0.14);
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
}

.token-bind-box button {
  background: #2f6f5e;
  color: #fff;
}

.token-bind-msg {
  margin: 0;
  color: #13723a;
  font-size: 13px;
  font-weight: 700;
}

.token-bind-msg.error {
  color: #c0395f;
}

.error-card {
  padding: 28px;
  text-align: center;
}

.error-card p {
  color: rgba(36, 24, 20, 0.68);
}

.detail-loading {
  min-height: 60vh;
  display: grid;
  place-items: center;
}

.spinner {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  border: 4px solid rgba(47, 111, 94, 0.18);
  border-top-color: #2f6f5e;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 720px) {
  .detail-shell {
    width: min(100vw - 20px, 920px);
    padding-top: 18px;
  }

  .hero,
  .content-card,
  .token-bind-panel,
  .error-card {
    border-radius: 22px;
  }

  .token-bind-box {
    grid-template-columns: 1fr;
  }
}
</style>
