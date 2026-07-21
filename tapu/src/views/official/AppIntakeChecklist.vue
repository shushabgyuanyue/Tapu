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
  worldRole: '',
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
  appType: '故事空间',
  touchReason: '',
  firstStep: '',
  flow: '',
  frequency: '中频',
  cadence: '按队列',
  instanceProgress: '是',
  contentTypes: '',
  relatedIps: '',
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
  events: '只有可继续驱动状态、内容或关系的高价值事实进入 events',
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
    world_role: yamlValue(form.worldRole),
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
  ip_relations: linesOf(form.relatedIps),
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
- 对其他 IP 的世界角色：${yamlValue(form.worldRole)}
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

## 五、IP 关系
${yamlList(linesOf(form.relatedIps), '待补充：关联 IP / 关系类型 / 关系描述 / 是否展示 / 是否触发联动')}

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

const loadEarphoneExample = () => {
  Object.assign(form, {
    ipName: '耳机小姐',
    oneLine: '一位喜欢旅行和收集故事的小伙伴，住在你的耳机里，把世界各处发生的小事讲给你听。',
    ipType: '官方核心 IP',
    personality: '冒险家；倾听者；朋友；有灵气；成熟克制；歌颂美好但不过甜。',
    userRelationship: '朋友，不是主人、客户或导购对象。',
    worldRole: '旅行者和倾听者，因为她会遇见其他 IP，所以能把关系讲成故事。',
    emotionalValue: '呈现奇妙的 IP 世界\n讲故事\n发现与连接\n关系情绪实体化',
    forbiddenTone: '导购口吻\n信息播报口吻\n过度煽情\n强行鸡汤',
    coreObject: '耳机贴纸',
    carrier: 'NFC 贴纸',
    material: 'NFC 贴纸 / 耳机贴纸',
    size: '轻量贴纸',
    inviteChannel: '外部渠道，用户拿到 token 后回到 Mint Space 接入',
    shopFocus: '声音陪伴\n手账感视觉\n跨 IP 关系入口',
    visualNeeds: '生活插画\n声音可视化\n留白\n柔和但不幼稚',
    appName: '耳机小姐 · 故事空间',
    appType: '故事空间',
    touchReason: '用户想听她带回来的故事，也通过她认识其他 IP。',
    firstStep: '进入声音空间，解析该实例下一段故事。',
    flow: '触碰耳机小姐\n进入声音空间\n检查该实例故事队列\n播放插画与语音\n二次触碰时展示联动邀请\n点击进入关联 IP 官方示例',
    frequency: '高频',
    cadence: '按实例队列',
    instanceProgress: '是',
    contentTypes: '周期故事：标题、正文、语音文案、插画、语音、可选音乐\n联动邀请：场景文字、关系标签、联动插画、音乐、入口\n记忆故事：标题、摘要、发生过的故事、可选图片/语音',
    relatedIps: '纸巾小狗：好朋友，会互相惦记；商品详情展示；可触发联动\n答案之书：老师，偶尔点醒她；商品详情展示；可触发联动\n旅行检查单：欣赏它把出发前的世界整理清楚；商品详情展示',
    keyOperations: 'object.touch\nstory.play\nstory.play_completed\ngateway.open_ip\nmemory.view',
    eventRules: 'story.play_completed 推进实例级故事队列\n高频触碰可提炼为 emotion.frequent_touch\n联动入口点击可记录 relationship.gateway_opened',
  });
};
</script>

<template>
  <div class="intake-page">
    <header class="intake-hero">
      <div>
        <p>WhatMint OS Intake</p>
        <h2>IP / 应用接入清单</h2>
        <span>你只填产品灵魂、实体、体验、内容和关系。系统字段、连接表、事件边界和权限策略由范式推导。</span>
      </div>
      <button type="button" @click="loadEarphoneExample">载入耳机小姐示例</button>
    </header>

    <section class="guide-strip">
      <article>
        <strong>你负责</strong>
        <p>它是谁、为什么被触碰、会如何回应、和谁有关系。</p>
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
          <label>IP 名称<input v-model="form.ipName" placeholder="例如：耳机小姐" /></label>
          <label>一句话介绍<textarea v-model="form.oneLine" rows="2" /></label>
          <div class="field-grid">
            <label>IP 类型<select v-model="form.ipType"><option>官方核心 IP</option><option>官方普通 IP</option><option>用户创作 IP</option></select></label>
            <label>核心人格<input v-model="form.personality" placeholder="冒险家；倾听者；朋友" /></label>
          </div>
          <label>对用户的关系<input v-model="form.userRelationship" placeholder="朋友 / 陪伴者 / 记录者..." /></label>
          <label>对其他 IP 的关系角色<input v-model="form.worldRole" placeholder="倾听者 / 老师 / 旅行者 / 守护者..." /></label>
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
            <label>应用类型<select v-model="form.appType"><option>故事空间</option><option>陪伴空间</option><option>答案空间</option><option>检查空间</option><option>纪念空间</option><option>其他</option></select></label>
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
          <h3>四、内容、关系、事件</h3>
          <label>内容类型<textarea v-model="form.contentTypes" rows="5" placeholder="一行一种：内容类型：字段、资源、展示方式" /></label>
          <label>关联 IP<textarea v-model="form.relatedIps" rows="5" placeholder="一行一个：IP：关系、描述、是否展示、是否联动" /></label>
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
