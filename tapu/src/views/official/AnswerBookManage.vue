<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createAnswerBookCard,
  createAnswerBookDeck,
  createAnswerBookTokens,
  deleteAnswerBookCard,
  deleteAnswerBookToken,
  fetchAnswerBookCards,
  fetchAnswerBookDecks,
  fetchAnswerBookTokens,
  updateAnswerBookCard,
  updateAnswerBookDeck,
} from '../../api';

const DEMO_TOKEN = '2a7c9f0e4b6d41f3a8e5c1d9b0f62473';

const loading = ref(false);
const activePanel = ref<'cards' | 'tokens' | 'deck'>('cards');
const decks = ref<any[]>([]);
const cards = ref<any[]>([]);
const tokens = ref<any[]>([]);
const activeDeckId = ref('');
const editingCardId = ref('');
const msg = ref('');
const msgError = ref(false);

const deckForm = ref({
  name: '',
  subtitle: '',
  description: '',
  tone_notes: '',
  theme_color: '#2f6f5e',
  status: 'active',
});

const cardForm = ref({
  answer: '',
  response: '',
  action: '',
  tag: '',
  sort_order: 0,
  status: 'active',
});

const tokenForm = ref({
  label: '',
  count: 1,
  status: 'active',
});

const activeDeck = computed(() => decks.value.find(deck => deck.id === activeDeckId.value) || decks.value[0] || null);
const filteredCards = computed(() => cards.value.filter(card => !activeDeck.value || card.deck_id === activeDeck.value.id));
const demoToken = computed(() => tokens.value.find(item => item.token === DEMO_TOKEN)?.token || tokens.value[0]?.token || DEMO_TOKEN);
const answerUrl = computed(() => `${window.location.origin}/answer?key=${encodeURIComponent(demoToken.value)}`);

const tabs = [
  { key: 'cards', label: '答案卡', hint: '维护 100 组回应' },
  { key: 'tokens', label: 'Token / NFC', hint: '生成触碰入口' },
  { key: 'deck', label: '牌组气质', hint: '调整应用表达' },
] as const;

const showMessage = (text: string, isError = false) => {
  msg.value = text;
  msgError.value = isError;
};

const hydrateDeckForm = () => {
  if (!activeDeck.value) return;
  deckForm.value = {
    name: activeDeck.value.name || '',
    subtitle: activeDeck.value.subtitle || '',
    description: activeDeck.value.description || '',
    tone_notes: activeDeck.value.tone_notes || '',
    theme_color: activeDeck.value.theme_color || '#2f6f5e',
    status: activeDeck.value.status || 'active',
  };
};

const resetCardForm = () => {
  editingCardId.value = '';
  cardForm.value = {
    answer: '',
    response: '',
    action: '',
    tag: '',
    sort_order: (filteredCards.value.length || 0) + 1,
    status: 'active',
  };
};

const loadAll = async () => {
  loading.value = true;
  const [deckRows, tokenRows] = await Promise.all([
    fetchAnswerBookDecks(),
    fetchAnswerBookTokens({ page: 1, pageSize: 100 }),
  ]);
  decks.value = Array.isArray(deckRows) ? deckRows : [];
  tokens.value = Array.isArray(tokenRows.items) ? tokenRows.items : [];
  if (!activeDeckId.value && decks.value[0]) activeDeckId.value = decks.value[0].id;
  cards.value = activeDeckId.value ? await fetchAnswerBookCards(activeDeckId.value) : [];
  if (!Array.isArray(cards.value)) cards.value = [];
  hydrateDeckForm();
  resetCardForm();
  loading.value = false;
};

const chooseDeck = async () => {
  cards.value = activeDeckId.value ? await fetchAnswerBookCards(activeDeckId.value) : [];
  if (!Array.isArray(cards.value)) cards.value = [];
  hydrateDeckForm();
  resetCardForm();
};

const saveDeck = async () => {
  if (!deckForm.value.name.trim()) return showMessage('请填写牌组名称', true);
  const result = activeDeck.value
    ? await updateAnswerBookDeck(activeDeck.value.id, deckForm.value)
    : await createAnswerBookDeck(deckForm.value);
  if (result.error) return showMessage(result.error, true);
  showMessage('牌组已保存');
  await loadAll();
};

const editCard = (card: any) => {
  editingCardId.value = card.id;
  cardForm.value = {
    answer: card.answer || '',
    response: card.response || '',
    action: card.action || '',
    tag: card.tag || '',
    sort_order: Number(card.sort_order || 0),
    status: card.status || 'active',
  };
  activePanel.value = 'cards';
};

const submitCard = async () => {
  if (!activeDeck.value) return showMessage('请先选择牌组', true);
  if (!cardForm.value.answer.trim()) return showMessage('请填写主句', true);
  const payload = {
    deck_id: activeDeck.value.id,
    ...cardForm.value,
    answer: cardForm.value.answer.trim(),
    response: cardForm.value.response.trim(),
    action: cardForm.value.action.trim(),
    tag: cardForm.value.tag.trim(),
    sort_order: Number(cardForm.value.sort_order) || 0,
  };
  const result = editingCardId.value
    ? await updateAnswerBookCard(editingCardId.value, payload)
    : await createAnswerBookCard(payload);
  if (result.error) return showMessage(result.error, true);
  showMessage(editingCardId.value ? '答案卡已更新' : '答案卡已创建');
  await chooseDeck();
};

const removeCard = async (card: any) => {
  if (!confirm(`删除这张答案卡：${card.answer}`)) return;
  const result = await deleteAnswerBookCard(card.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('答案卡已删除');
  await chooseDeck();
};

const createToken = async () => {
  if (!activeDeck.value) return showMessage('请先选择牌组', true);
  const result = await createAnswerBookTokens({
    deck_id: activeDeck.value.id,
    label: tokenForm.value.label.trim(),
    count: Number(tokenForm.value.count) || 1,
    status: tokenForm.value.status,
  });
  if (result.error) return showMessage(result.error, true);
  showMessage(`已生成 ${result.tokens?.length || 1} 个 token`);
  await loadAll();
};

const removeToken = async (token: any) => {
  if (!confirm(`删除 token：${token.label || token.token}`)) return;
  const result = await deleteAnswerBookToken(token.id);
  if (result.error) return showMessage(result.error, true);
  showMessage('token 已删除');
  await loadAll();
};

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text);
  showMessage('已复制');
};

onMounted(loadAll);
</script>

<template>
  <div class="abm">
    <header class="console-head">
      <div>
        <p>Answer Book Application</p>
        <h2>答案之书运营台</h2>
        <span>管理牌组、答案卡和 NFC token。默认牌组已内置 100 组正念式回应。</span>
      </div>
      <button @click="loadAll">{{ loading ? '刷新中...' : '刷新数据' }}</button>
    </header>

    <p v-if="msg" :class="['msg', { error: msgError }]">{{ msg }}</p>

    <section class="deck-switch">
      <label>
        <span>当前牌组</span>
        <select v-model="activeDeckId" @change="chooseDeck">
          <option v-for="deck in decks" :key="deck.id" :value="deck.id">{{ deck.name }}</option>
        </select>
      </label>
      <div class="deck-metrics">
        <strong>{{ filteredCards.length }}</strong>
        <span>张答案卡</span>
      </div>
      <div class="deck-metrics">
        <strong>{{ tokens.length }}</strong>
        <span>个 token</span>
      </div>
      <button class="copy-link" @click="copyText(answerUrl)">复制演示链接</button>
    </section>

    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="{ active: activePanel === tab.key }"
        @click="activePanel = tab.key"
      >
        <strong>{{ tab.label }}</strong>
        <span>{{ tab.hint }}</span>
      </button>
    </nav>

    <section v-if="activePanel === 'cards'" class="cards-layout">
      <article class="panel form-panel">
        <h3>{{ editingCardId ? '编辑答案卡' : '新增答案卡' }}</h3>
        <div class="form-grid">
          <label class="full"><span>主句</span><textarea v-model="cardForm.answer" class="answer-input" placeholder="先让呼吸进来，答案晚点再说。"></textarea></label>
          <label class="full"><span>回应</span><textarea v-model="cardForm.response" placeholder="身体缺氧时，任何答案都会看起来像威胁。"></textarea></label>
          <label class="full"><span>小动作</span><input v-model="cardForm.action" placeholder="深吸气，长呼气，重复五轮。" /></label>
          <label><span>标签</span><input v-model="cardForm.tag" placeholder="呼吸" /></label>
          <label><span>排序</span><input v-model.number="cardForm.sort_order" type="number" /></label>
          <label>
            <span>状态</span>
            <select v-model="cardForm.status">
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="paused">paused</option>
            </select>
          </label>
        </div>
        <div class="actions">
          <button class="primary" @click="submitCard">{{ editingCardId ? '保存' : '创建' }}</button>
          <button class="ghost" @click="resetCardForm">清空</button>
        </div>
      </article>

      <article class="panel list-panel">
        <h3>答案卡库</h3>
        <div class="card-list">
          <article v-for="card in filteredCards" :key="card.id" class="answer-item">
            <div>
              <span>#{{ card.sort_order }} · {{ card.tag || '未标记' }} · {{ card.status }}</span>
              <strong>{{ card.answer }}</strong>
              <p>{{ card.response }}</p>
              <small>{{ card.action }}</small>
            </div>
            <div class="row-actions">
              <button @click="editCard(card)">编辑</button>
              <button class="danger" @click="removeCard(card)">删除</button>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section v-if="activePanel === 'tokens'" class="panel token-panel">
      <div class="token-head">
        <div>
          <h3>NFC Token</h3>
          <p>演示链接：<code>{{ answerUrl }}</code></p>
        </div>
        <button @click="copyText(answerUrl)">复制演示链接</button>
      </div>
      <div class="token-form">
        <label><span>标签</span><input v-model="tokenForm.label" placeholder="答案之书-第一批" /></label>
        <label><span>数量</span><input v-model.number="tokenForm.count" type="number" min="1" max="100" /></label>
        <label>
          <span>状态</span>
          <select v-model="tokenForm.status">
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </label>
      </div>
      <div class="actions"><button class="primary" @click="createToken">生成 token</button></div>
      <div class="token-list">
        <article v-for="item in tokens" :key="item.id" class="token-item">
          <div>
            <strong>{{ item.label || item.deck_name }}</strong>
            <code>{{ item.token }}</code>
            <span>{{ item.deck_name }} · {{ item.status }}</span>
          </div>
          <div class="row-actions">
            <button @click="copyText(`${window.location.origin}/answer?key=${encodeURIComponent(item.token)}`)">复制</button>
            <button class="danger" @click="removeToken(item)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="activePanel === 'deck'" class="deck-layout">
      <article class="panel form-panel">
        <h3>牌组气质</h3>
        <div class="form-grid">
          <label><span>名称</span><input v-model="deckForm.name" /></label>
          <label><span>主题色</span><input v-model="deckForm.theme_color" type="color" /></label>
          <label class="full"><span>副标题</span><input v-model="deckForm.subtitle" /></label>
          <label class="full"><span>描述</span><textarea v-model="deckForm.description"></textarea></label>
          <label class="full"><span>语气说明</span><textarea v-model="deckForm.tone_notes"></textarea></label>
          <label>
            <span>状态</span>
            <select v-model="deckForm.status">
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="paused">paused</option>
            </select>
          </label>
        </div>
        <div class="actions"><button class="primary" @click="saveDeck">保存牌组</button></div>
      </article>

      <article class="deck-preview" :style="{ '--deck-accent': deckForm.theme_color }">
        <span>{{ deckForm.name || '答案之书' }}</span>
        <h3>{{ cardForm.answer || '碰一下，答案不会拯救你。' }}</h3>
        <p>{{ cardForm.response || '它会把你从脑内会议里请出来。' }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.abm {
  display: grid;
  gap: 16px;
}

.console-head,
.deck-switch,
.panel,
.deck-preview {
  border: 1px solid #e2ebe5;
  background: #fffefa;
}

.console-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
  padding: 24px;
  color: #f7fff7;
  background:
    linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px),
    linear-gradient(135deg, #18342d, #2f6f5e 62%, #9a3d2f);
  background-size: 22px 22px, auto;
}

.console-head p,
.console-head h2,
.console-head span {
  margin: 0;
}

.console-head p {
  color: #bde8d9;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.console-head h2 {
  margin-top: 8px;
  font-size: 30px;
  letter-spacing: 0;
}

.console-head span {
  display: block;
  margin-top: 8px;
  max-width: 720px;
  color: rgba(247,255,247,.76);
  line-height: 1.7;
}

.console-head button,
.copy-link,
.primary,
.ghost,
.row-actions button,
.token-head button {
  min-height: 40px;
  border: 0;
  padding: 0 14px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.console-head button,
.primary,
.copy-link {
  background: #18342d;
  color: #fff;
}

.ghost,
.row-actions button,
.token-head button {
  border: 1px solid #dbe6df;
  background: #fff;
  color: #2f413a;
}

.danger {
  color: #b3392d !important;
  border-color: #f1c7bf !important;
}

.msg {
  margin: 0;
  padding: 10px 12px;
  background: #edf8f0;
  color: #1d6b38;
  font-size: 13px;
}

.msg.error {
  background: #fff1ee;
  color: #ad3028;
}

.deck-switch {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) auto auto auto;
  gap: 12px;
  align-items: end;
  padding: 14px;
}

.deck-metrics {
  display: grid;
  gap: 2px;
  min-width: 88px;
  padding: 10px 12px;
  background: #f3f7f2;
}

.deck-metrics strong {
  color: #18342d;
  font-size: 20px;
}

.deck-metrics span {
  color: #6f7d75;
  font-size: 12px;
}

.tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.tabs button {
  display: grid;
  gap: 4px;
  border: 1px solid #dfe8e2;
  background: #fffefa;
  color: #5f6d66;
  padding: 12px;
  cursor: pointer;
  text-align: left;
}

.tabs button.active {
  color: #fff;
  border-color: #18342d;
  background: #18342d;
}

.tabs span {
  font-size: 11px;
  opacity: .72;
}

.cards-layout,
.deck-layout {
  display: grid;
  grid-template-columns: minmax(280px, .78fr) minmax(0, 1.22fr);
  gap: 16px;
}

.panel {
  min-width: 0;
  padding: 18px;
}

.panel h3 {
  margin: 0 0 14px;
  font-size: 18px;
}

label {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #5b6961;
  font-size: 12px;
  font-weight: 900;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #dfe8e2;
  background: #fff;
  padding: 10px 11px;
  color: #17231f;
  outline: none;
}

textarea {
  min-height: 112px;
  resize: vertical;
  line-height: 1.7;
}

.answer-input {
  min-height: 92px;
  font-size: 18px;
  font-weight: 900;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #2f6f5e;
  box-shadow: 0 0 0 3px rgba(47,111,94,.11);
}

.form-grid,
.token-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}

.token-form {
  grid-template-columns: repeat(3, minmax(0,1fr));
}

.full {
  grid-column: 1 / -1;
}

.actions,
.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.card-list,
.token-list {
  display: grid;
  gap: 10px;
  max-height: 760px;
  overflow: auto;
}

.answer-item,
.token-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 13px;
  border: 1px solid #e3ece6;
  background: #fff;
}

.answer-item > div:first-child,
.token-item > div:first-child {
  min-width: 0;
}

.answer-item span,
.token-item span {
  display: block;
  color: #7a877f;
  font-size: 12px;
  line-height: 1.6;
}

.answer-item strong {
  display: block;
  margin-top: 5px;
  color: #18231f;
  font-size: 16px;
  line-height: 1.5;
}

.answer-item p {
  display: -webkit-box;
  margin: 6px 0;
  overflow: hidden;
  color: #4f5f57;
  font-size: 13px;
  line-height: 1.6;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.answer-item small {
  color: #9a3d2f;
  line-height: 1.5;
}

.token-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  margin-bottom: 14px;
}

.token-head p {
  margin: 0;
  color: #6f7d75;
  line-height: 1.7;
}

code {
  color: #2f6f5e;
  font-size: 11px;
  word-break: break-all;
}

.token-item code {
  display: block;
  margin: 6px 0;
}

.deck-preview {
  --deck-accent: #2f6f5e;
  align-self: start;
  padding: 26px;
  background:
    linear-gradient(90deg, rgba(24,52,45,.055) 1px, transparent 1px),
    linear-gradient(180deg, rgba(24,52,45,.05) 1px, transparent 1px),
    #fbf7ef;
  background-size: 24px 24px, 24px 24px, auto;
}

.deck-preview span {
  color: var(--deck-accent);
  font-size: 12px;
  font-weight: 950;
}

.deck-preview h3 {
  margin: 28px 0 14px;
  color: #17231f;
  font-family: Georgia, "Times New Roman", "Noto Serif SC", serif;
  font-size: 42px;
  line-height: 1.18;
}

.deck-preview p {
  color: #4f5f57;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.8;
}

@media (max-width: 980px) {
  .console-head,
  .deck-switch,
  .cards-layout,
  .deck-layout,
  .form-grid,
  .token-form {
    grid-template-columns: 1fr;
  }

  .tabs {
    grid-template-columns: 1fr;
  }

  .token-head,
  .answer-item,
  .token-item {
    flex-direction: column;
    align-items: stretch;
  }

  .console-head button,
  .copy-link,
  .primary,
  .ghost,
  .row-actions button,
  .token-head button {
    width: 100%;
  }

  .card-list,
  .token-list {
    max-height: none;
    overflow: visible;
  }
}
</style>
