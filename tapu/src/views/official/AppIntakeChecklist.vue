<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import '../../styles/app-intake-checklist.css';

const copied = ref('');

const form = reactive({
  ipName: '',
  oneLine: '',
  ipType: '官方核心 IP',
  personality: '',
  userRelationship: '',
  sceneRole: '',
  emotionalValue: '',
  forbiddenTone: '',
  coreObject: '',
  carrier: 'NFC 贴纸',
  material: '',
  size: '',
  inviteChannel: '',
  shopFocus: '',
  visualNeeds: '',
  appName: '',
  appType: '意义表达',
  touchReason: '',
  firstStep: '',
  flow: '',
  frequency: '中频',
  cadence: '按队列',
  instanceProgress: '是',
  contentTypes: '',
  contextHints: '',
  keyOperations: '',
  eventRules: '',
  userCreation: '允许',
  officialCreation: '允许',
  officialDefault: '官方手动选择',
  tokenBinding: '通过 IP token 绑定',
  specialAdmin: '不需要，优先走创作中心和官方默认绑定',
});

const presets = {
  status: 'active',
  version: '1.0.0',
  creator: 'official',
  mapping: '业务上一对一，技术上通过连接表支持多对多',
  creationFlow: '官方和用户统一走创作中心',
  resources: '所有图片、音频、视频、Lottie、AI 文件统一进入 resources',
  operations: '触碰、播放、完成、点击入口等先进入 operations',
  events: '只有可继续驱动状态、内容或后续体验的高价值事实进入 events',
  defaultPolicy: '官方内容不自动绑定，必须由官方权限手动设为默认',
  skillMode: 'fixed_rules_v1，不引入 AI',
};

const linesOf = (value: string) => value
  .split('\n')
  .map(item => item.trim())
  .filter(Boolean);

const yamlList = (items: string[], fallback = '待补充') => (
  items.length ? items.map(item => `    - ${item}`).join('\n') : `    - ${fallback}`
);

const yamlValue = (value: string, fallback = '待补充') => value.trim() || fallback;

const intake = computed(() => ({
  ip_definition: {
    name: yamlValue(form.ipName),
    one_line: yamlValue(form.oneLine),
    ip_type: form.ipType,
    creator_user: presets.creator,
    personality: yamlValue(form.personality),
    user_relationship: yamlValue(form.userRelationship),
    scene_role: yamlValue(form.sceneRole),
    emotional_value: linesOf(form.emotionalValue),
    forbidden_tone: linesOf(form.forbiddenTone),
    physical: {
      core_object: yamlValue(form.coreObject),
      carrier: form.carrier,
      material: yamlValue(form.material),
      size: yamlValue(form.size),
      invite_channel: yamlValue(form.inviteChannel, '外部渠道'),
    },
    shop: {
      focus: linesOf(form.shopFocus),
      visual_needs: linesOf(form.visualNeeds),
    },
  },
  application_definition: {
    name: yamlValue(form.appName || (form.ipName ? `${form.ipName} · 应用空间` : '待补充')),
    version_no: presets.version,
    app_type: form.appType,
    why_touch: yamlValue(form.touchReason),
    first_step: yamlValue(form.firstStep),
    flow: linesOf(form.flow),
    frequency: form.frequency,
    cadence: form.cadence,
    instance_progress: form.instanceProgress,
    skill_mode: presets.skillMode,
  },
  content_definitions: linesOf(form.contentTypes),
  context_hints: linesOf(form.contextHints),
  operations_and_events: {
    key_operations: linesOf(form.keyOperations),
    event_rules: linesOf(form.eventRules),
  },
  permission_and_operation: {
    user_creation: form.userCreation,
    official_creation: form.officialCreation,
    official_default: form.officialDefault,
    token_binding: form.tokenBinding,
    special_admin: form.specialAdmin,
  },
  system_presets: presets,
}));

const outputMarkdown = computed(() => `# WhatMint IP / 应用接入清单

## 一、IP 定义
- IP 名称：${yamlValue(form.ipName)}
- 一句话介绍：${yamlValue(form.oneLine)}
- IP 类型：${form.ipType}
- 创作者：${presets.creator}
- 核心人格：${yamlValue(form.personality)}
- 对用户的关系：${yamlValue(form.userRelationship)}
- 场景角色：${yamlValue(form.sceneRole)}
- 情绪价值：
${yamlList(linesOf(form.emotionalValue))}
- 禁忌口吻：
${yamlList(linesOf(form.forbiddenTone))}

## 二、实体与商品
- 核心物：${yamlValue(form.coreObject)}
- 实体媒介：${form.carrier}
- 材质：${yamlValue(form.material)}
- 规格：${yamlValue(form.size)}
- 外部邀请渠道：${yamlValue(form.inviteChannel, '外部渠道')}
- 商品展示重点：
${yamlList(linesOf(form.shopFocus))}
- 封面 / 主视觉需求：
${yamlList(linesOf(form.visualNeeds))}

## 三、应用定义
- 应用名称：${yamlValue(form.appName || (form.ipName ? `${form.ipName} · 应用空间` : '待补充'))}
- 应用类型：${form.appType}
- 版本号：${presets.version}
- 用户为什么触碰它：${yamlValue(form.touchReason)}
- 触碰后第一步：${yamlValue(form.firstStep)}
- 完整体验流程：
${yamlList(linesOf(form.flow))}
- 使用频率：${form.frequency}
- 内容更新节奏：${form.cadence}
- 是否需要实例级进度：${form.instanceProgress}
- Skill 模式：${presets.skillMode}

## 四、内容定义
${yamlList(linesOf(form.contentTypes), '待补充：内容类型 / 需要字段 / 需要资源 / 展示方式')}

## 五、上下文提示
${yamlList(linesOf(form.contextHints), '待补充：这个应用后续可能读取哪些 OS 上下文，例如拥有状态、最近完成、最近触碰、内容播放完成')}

## 六、操作与事件
- 关键操作：
${yamlList(linesOf(form.keyOperations), '待补充：例如触碰、播放、完成、点击入口')}
- 事件提炼规则：
${yamlList(linesOf(form.eventRules), '待补充：哪些操作会变成高价值事件')}

## 七、权限与运营
- 普通用户创作：${form.userCreation}
- 官方创作：${form.officialCreation}
- 官方默认内容：${form.officialDefault}
- 用户绑定方式：${form.tokenBinding}
- 是否需要官方后台特殊管理：${form.specialAdmin}

## 系统预设，由 Codex 推导
- 状态：${presets.status}
- IP 与应用映射：${presets.mapping}
- 创作流：${presets.creationFlow}
- 资源：${presets.resources}
- 操作层：${presets.operations}
- 事件层：${presets.events}
- 默认内容策略：${presets.defaultPolicy}
`);

const outputJson = computed(() => JSON.stringify(intake.value, null, 2));

const copyText = async (text: string, label: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  copied.value = label;
  window.setTimeout(() => {
    if (copied.value === label) copied.value = '';
  }, 1800);
};

const loadTissuePuppyExample = () => {
  Object.assign(form, {
    ipName: '纸巾小狗',
    oneLine: '一只总会在你需要的时候递上一点温柔的小狗。',
    ipType: '官方核心 IP',
    personality: '温柔；安静；靠近但不打扰；成熟克制；有一点笨拙的真诚。',
    userRelationship: '在需要安慰的瞬间出现的小小陪伴，不是治疗师，也不是鸡汤播报。',
    sceneRole: '安慰场景的现实入口，把一个礼物或摆件原本想表达的关心补出来。',
    emotionalValue: '安慰\n陪伴\n表达关心\n让实体礼物拥有被触碰后的回应',
    forbiddenTone: '医疗承诺\n过度煽情\n强行治愈\n硬广口吻',
    coreObject: '纸巾小狗实体 / 贴纸',
    carrier: 'NFC 贴纸',
    material: '贴纸 / 玩偶 / 摆件',
    size: '按实体形态补充',
    inviteChannel: '外部渠道，用户拿到 token 后回到 Mint Space 接入',
    shopFocus: '安慰场景\n实体触碰后的数字表达\nAR / 视频召唤体验\n可自定义内容',
    visualNeeds: '柔软但不幼稚\n像真实出现在身边\n留白\n轻量仪式感',
    appName: '纸巾小狗 · 安慰空间',
    appType: '意义表达',
    touchReason: '用户在需要安慰、表达关心或想看见小狗出现时触碰它。',
    firstStep: '解析 token，找到该实体默认内容，并用 OS 渲染器全屏播放或 AR 展示。',
    flow: '触碰纸巾小狗\n解析实体 token\n读取默认内容\n播放视频或 AR 召唤\n引导未绑定实体接入 Mint Space',
    frequency: '中频',
    cadence: '按默认内容',
    instanceProgress: '否',
    contentTypes: '安慰视频：标题、视频、可选封面、播放参数\nAR 召唤：标题、透明视频或平面素材、可选 marker、渲染参数',
    contextHints: '未绑定 token：可展示接入 Mint Space 提示\n已绑定实体：不再展示商业提示\n播放完成：可记录 content.play_completed',
    keyOperations: 'object.touch\ncontent.resolve\ncontent.play\ncontent.play_completed\nspace_invitation.open',
    eventRules: '高频触碰可提炼为 comfort.frequent_touch\n播放完成可成为后续体验上下文\n绑定成功记录 entity.claimed',
  });
};
</script>

<template>
  <div class="intake-page">
    <header class="intake-hero">
      <div>
        <p>WhatMint OS Intake</p>
        <h2>IP / 应用接入清单</h2>
        <span>你只填产品灵魂、现实场景、实体入口、触碰体验和内容形态。系统字段、连接表、事件边界和权限策略由范式推导。</span>
      </div>
      <button type="button" @click="loadTissuePuppyExample">载入纸巾小狗示例</button>
    </header>

    <section class="guide-strip">
      <article>
        <strong>你负责</strong>
        <p>它是谁、为什么被触碰、会如何回应、补上物原本想表达的哪一部分。</p>
      </article>
      <article>
        <strong>系统预设</strong>
        <p>状态、版本、资源、事件、权限、连接表和默认内容策略。</p>
      </article>
      <article>
        <strong>输出用途</strong>
        <p>复制后贴给 Codex，即可继续落核心表、种子数据和应用接入。</p>
      </article>
    </section>

    <div class="workspace">
      <form class="intake-form" @submit.prevent>
        <section class="form-card">
          <h3>一、IP 是谁</h3>
          <label>IP 名称<input v-model="form.ipName" placeholder="例如：纸巾小狗" /></label>
          <label>一句话介绍<textarea v-model="form.oneLine" rows="2" /></label>
          <div class="field-grid">
            <label>IP 类型<select v-model="form.ipType"><option>官方核心 IP</option><option>官方普通 IP</option><option>用户创作 IP</option></select></label>
            <label>核心人格<input v-model="form.personality" placeholder="温柔；守护；克制" /></label>
          </div>
          <label>对用户的关系<input v-model="form.userRelationship" placeholder="陪伴者 / 入口 / 记录者..." /></label>
          <label>场景角色<input v-model="form.sceneRole" placeholder="安慰入口 / 出发仪式 / 选择回应 / 桌面空间..." /></label>
          <label>情绪价值<textarea v-model="form.emotionalValue" rows="3" placeholder="一行一个，例如：讲故事" /></label>
          <label>禁忌口吻<textarea v-model="form.forbiddenTone" rows="3" placeholder="一行一个，例如：导购口吻" /></label>
        </section>

        <section class="form-card">
          <h3>二、实体与商品</h3>
          <div class="field-grid">
            <label>核心物<input v-model="form.coreObject" placeholder="例如：耳机贴纸" /></label>
            <label>实体媒介<select v-model="form.carrier"><option>NFC 贴纸</option><option>摆件</option><option>卡片</option><option>钥匙扣</option><option>其他</option></select></label>
          </div>
          <div class="field-grid">
            <label>材质<input v-model="form.material" /></label>
            <label>规格<input v-model="form.size" /></label>
          </div>
          <label>外部邀请渠道<input v-model="form.inviteChannel" placeholder="例如：外部渠道，收到 token 后回到 Mint Space 接入" /></label>
          <label>商品展示重点<textarea v-model="form.shopFocus" rows="3" placeholder="一行一个" /></label>
          <label>封面 / 主视觉需求<textarea v-model="form.visualNeeds" rows="3" placeholder="一行一个" /></label>
        </section>

        <section class="form-card">
          <h3>三、它怎么活着</h3>
          <div class="field-grid">
            <label>应用名称<input v-model="form.appName" placeholder="不填则按 IP 名称生成" /></label>
            <label>应用类型<select v-model="form.appType"><option>意义表达</option><option>行为辅助</option><option>状态空间</option><option>AR 场景</option><option>留言传递</option><option>其他</option></select></label>
          </div>
          <label>用户为什么触碰它<textarea v-model="form.touchReason" rows="2" /></label>
          <label>触碰后第一步发生什么<textarea v-model="form.firstStep" rows="2" /></label>
          <label>完整体验流程<textarea v-model="form.flow" rows="5" placeholder="一行一步" /></label>
          <div class="field-grid">
            <label>使用频率<select v-model="form.frequency"><option>高频</option><option>中频</option><option>低频</option></select></label>
            <label>内容节奏<select v-model="form.cadence"><option>按队列</option><option>按时间</option><option>随机</option><option>事件触发</option><option>混合</option></select></label>
            <label>实例级进度<select v-model="form.instanceProgress"><option>是</option><option>否</option><option>待判断</option></select></label>
          </div>
        </section>

        <section class="form-card">
          <h3>四、内容、上下文、事件</h3>
          <label>内容类型<textarea v-model="form.contentTypes" rows="5" placeholder="一行一种：内容类型：字段、资源、展示方式" /></label>
          <label>上下文提示<textarea v-model="form.contextHints" rows="5" placeholder="一行一个：可能读取的 OS 上下文，例如未绑定、已拥有、最近完成、播放完成" /></label>
          <label>关键操作<textarea v-model="form.keyOperations" rows="4" placeholder="一行一个：触碰、播放、完成、点击入口..." /></label>
          <label>事件提炼规则<textarea v-model="form.eventRules" rows="4" placeholder="一行一个：什么操作在什么条件下变成事件" /></label>
        </section>

        <section class="form-card">
          <h3>五、权限与运营</h3>
          <div class="field-grid">
            <label>普通用户创作<select v-model="form.userCreation"><option>允许</option><option>不允许</option><option>待定</option></select></label>
            <label>官方创作<select v-model="form.officialCreation"><option>允许</option><option>不允许</option></select></label>
            <label>官方默认内容<select v-model="form.officialDefault"><option>官方手动选择</option><option>不需要默认内容</option><option>待定</option></select></label>
            <label>用户绑定方式<select v-model="form.tokenBinding"><option>通过 IP token 绑定</option><option>无需绑定</option><option>待定</option></select></label>
          </div>
          <label>是否需要官方后台特殊管理<textarea v-model="form.specialAdmin" rows="2" /></label>
        </section>
      </form>

      <aside class="output-panel">
        <div class="output-actions">
          <div>
            <span>实时结构</span>
            <strong>{{ form.ipName || '新 IP' }}</strong>
          </div>
          <button type="button" @click="copyText(outputMarkdown, 'markdown')">
            {{ copied === 'markdown' ? '已复制' : '复制清单' }}
          </button>
          <button type="button" @click="copyText(outputJson, 'json')">
            {{ copied === 'json' ? '已复制' : '复制 JSON' }}
          </button>
        </div>
        <pre>{{ outputMarkdown }}</pre>
      </aside>
    </div>
  </div>
</template>
