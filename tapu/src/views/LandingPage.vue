<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getConfig } from '../api';
import NavBar from '../components/NavBar.vue';

const router = useRouter();
const communityEnabled = ref(false);
const wishlistEnabled = ref(false);

const primaryPath = computed(() => (communityEnabled.value ? '/community' : '/shop'));
const primaryCtaLabel = computed(() => (communityEnabled.value ? '进入灵感社区' : '看看可以触碰的物'));

const objectCards = [
  {
    name: '纸巾小狗',
    label: '情绪 IP',
    desc: '把一句祝福、一段关系、一份陪伴，安放进一个长期存在的实体里。',
    image: new URL('../IPimg/永远系列-纸巾小狗-合集.png', import.meta.url).href,
  },
  {
    name: '守护小狗',
    label: '关系载体',
    desc: '不是扫码看内容，而是触碰一个被赋予性格的物，进入它的小世界。',
    image: new URL('../IPimg/永远系列-守护小狗-合集.png', import.meta.url).href,
  },
  {
    name: '祈福小狗',
    label: '礼物入口',
    desc: '适合礼物、纪念日、企业伴手礼，也适合一个人安静地想起另一个人。',
    image: new URL('../IPimg/永远系列-祈福小狗-合集.png', import.meta.url).href,
  },
];

const lightApps = [
  {
    index: '01',
    name: '手账慢故事贴纸',
    desc: '一枚贴纸就是一个慢慢更新的数字角落，让普通物品多出故事、气味和时间。',
    tag: '内容容器',
  },
  {
    index: '02',
    name: '答案之书',
    desc: '碰一下，得到一张克制、正念、带一点黑色幽默的回应卡。',
    tag: '轻交互',
  },
  {
    index: '03',
    name: '情绪 IP',
    desc: '把数字祝福重新变成一个可触碰、可收藏、可复访的关系载体。',
    tag: '商业化',
  },
];

const principles = [
  'NFC 是入口，不是产品本身。',
  '实体是载体，内容是应用。',
  '每个贴纸、摆件、作品，都可以拥有自己的数字空间。',
  '后台隐藏复杂路由与权限，前台只保留一次轻轻的触碰。',
];

const goPrimary = () => {
  router.push(primaryPath.value);
};

onMounted(async () => {
  try {
    const [community, wishlist] = await Promise.all([
      getConfig('community_enabled'),
      getConfig('wishlist_enabled'),
    ]);
    communityEnabled.value = community.value === 'true' || community.value === true;
    wishlistEnabled.value = wishlist.value === 'true' || wishlist.value === true;
  } catch {
    communityEnabled.value = false;
    wishlistEnabled.value = false;
  }
});
</script>

<template>
  <div class="landing">
    <NavBar />

    <main>
      <section class="hero-section">
        <div class="hero-copy">
          <p class="eyebrow">WhatMint Object Space</p>
          <h1>
            给现实里的物，
            <span>安装情绪应用。</span>
          </h1>
          <p class="hero-sub">
            一枚 NFC 贴纸、一个摆件、一件作品，被触碰后打开自己的数字空间。
            我们用轻应用把物的特性延展出来，形成新的交互范式和情绪表达。
          </p>

          <div class="hero-actions">
            <button class="primary-btn" @click="goPrimary">{{ primaryCtaLabel }}</button>
            <button v-if="wishlistEnabled" class="secondary-btn" @click="router.push('/wishlist')">打开心愿单</button>
          </div>
        </div>

        <div class="hero-object" aria-label="WhatMint 触碰体验示意">
          <div class="tap-orbit">
            <span class="orbit-dot dot-a"></span>
            <span class="orbit-dot dot-b"></span>
            <span class="orbit-dot dot-c"></span>
          </div>
          <div class="object-card">
            <span class="object-chip">tap</span>
            <strong>答案之书</strong>
            <p>今天先别急着证明自己。把手松开一点，答案会浮上来。</p>
          </div>
          <div class="nfc-card">
            <span>NFC</span>
            <small>碰一下进入</small>
          </div>
        </div>
      </section>

      <section class="object-section">
        <div class="section-head">
          <p class="eyebrow">Objects As IP</p>
          <h2>用户先理解一个物，再慢慢理解一个系统。</h2>
          <span>贴纸、摆件、手作和礼物天然像 IP。我们把复杂的应用、内容、权限和运行时藏在后面。</span>
        </div>

        <div class="object-grid">
          <article v-for="item in objectCards" :key="item.name" class="physical-card">
            <img :src="item.image" :alt="item.name" />
            <div>
              <span>{{ item.label }}</span>
              <h3>{{ item.name }}</h3>
              <p>{{ item.desc }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="apps-section">
        <div class="apps-panel">
          <div class="section-head section-head--light">
            <p class="eyebrow">Light Apps First</p>
            <h2>先做爆款轻应用，再把共性抽成平台能力。</h2>
            <span>WhatMint 不是先教育用户什么是 OS，而是让用户碰到一个好玩的物，然后自然进入它的应用。</span>
          </div>

          <div class="app-list">
            <article v-for="app in lightApps" :key="app.name" class="light-app-card">
              <span class="app-index">{{ app.index }}</span>
              <div>
                <strong>{{ app.name }}</strong>
                <p>{{ app.desc }}</p>
              </div>
              <small>{{ app.tag }}</small>
            </article>
          </div>
        </div>
      </section>

      <section class="os-section">
        <div class="os-copy">
          <p class="eyebrow">WhatMint OS</p>
          <h2>真正的系统感，应该让使用者感觉不到系统。</h2>
          <p>
            管理端负责应用目录、内容集合、对象事件和绑定关系。
            用户端只需要一次触碰，一个恰到好处的回应，和一个愿意再次打开的小空间。
          </p>
        </div>

        <div class="principle-list">
          <div v-for="item in principles" :key="item" class="principle-item">
            <span></span>
            <p>{{ item }}</p>
          </div>
        </div>
      </section>

      <section class="final-cta">
        <p>有灵气，有个性，歌颂美好，同时成熟克制，兼具商业性。</p>
        <h2>让物开始表达，让触碰重新变得有意义。</h2>
        <button @click="goPrimary">{{ primaryCtaLabel }}</button>
      </section>
    </main>

    <footer class="landing-footer">
      <span>whatmint</span>
      <router-link to="/disclaimer">免责声明</router-link>
      <router-link to="/privacy">隐私政策</router-link>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  --ink: #1e1a17;
  --muted: #776f66;
  --paper: #fbf4e9;
  --cream: #fffaf1;
  --moss: #2f6f5e;
  --rose: #d98fb7;
  --amber: #b98234;
  min-height: 100vh;
  overflow: hidden;
  color: var(--ink);
  background:
    radial-gradient(circle at 8% 4%, rgba(217, 143, 183, 0.22), transparent 28%),
    radial-gradient(circle at 90% 12%, rgba(47, 111, 94, 0.16), transparent 30%),
    linear-gradient(180deg, #fffaf1 0%, #f7efe2 54%, #fbf7ef 100%);
  font-family: "LXGW WenKai", "Noto Serif SC", "Source Han Serif SC", "PingFang SC", serif;
}

main {
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 24px 72px;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
  gap: 42px;
  align-items: center;
  min-height: calc(100vh - 92px);
}

.eyebrow {
  margin: 0 0 12px;
  color: var(--moss);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.hero-copy h1 {
  max-width: 720px;
  margin: 0;
  font-size: clamp(48px, 8vw, 96px);
  line-height: 0.98;
  letter-spacing: -0.08em;
}

.hero-copy h1 span {
  display: block;
  color: var(--moss);
}

.hero-sub {
  max-width: 680px;
  margin: 28px 0 0;
  color: #5f574f;
  font-size: clamp(16px, 2vw, 19px);
  line-height: 1.9;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 34px;
}

.primary-btn,
.secondary-btn,
.final-cta button {
  border: 0;
  border-radius: 999px;
  padding: 14px 24px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 950;
  letter-spacing: 0.02em;
}

.primary-btn,
.final-cta button {
  color: #fff;
  background: linear-gradient(135deg, #171411, var(--moss));
  box-shadow: 0 16px 42px rgba(47, 111, 94, 0.24);
}

.secondary-btn {
  color: var(--ink);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(30, 26, 23, 0.1);
}

.hero-object {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 520px;
}

.tap-orbit {
  position: absolute;
  width: min(72vw, 480px);
  aspect-ratio: 1;
  border: 1px solid rgba(47, 111, 94, 0.16);
  border-radius: 50%;
  animation: orbit-breathe 7s ease-in-out infinite;
}

.tap-orbit::before,
.tap-orbit::after {
  content: "";
  position: absolute;
  inset: 12%;
  border: 1px solid rgba(217, 143, 183, 0.22);
  border-radius: 50%;
}

.tap-orbit::after {
  inset: 26%;
  border-color: rgba(185, 130, 52, 0.2);
}

.orbit-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--rose);
  box-shadow: 0 0 0 8px rgba(217, 143, 183, 0.12);
}

.dot-a {
  top: 12%;
  left: 22%;
}

.dot-b {
  right: 8%;
  top: 44%;
  background: var(--moss);
}

.dot-c {
  left: 32%;
  bottom: 8%;
  background: var(--amber);
}

.object-card {
  position: relative;
  z-index: 2;
  width: min(82vw, 360px);
  min-height: 430px;
  display: grid;
  align-content: end;
  padding: 28px;
  overflow: hidden;
  border: 1px solid rgba(30, 26, 23, 0.12);
  border-radius: 34px;
  color: #fff;
  background:
    radial-gradient(circle at 24% 16%, rgba(255, 255, 255, 0.34), transparent 26%),
    radial-gradient(circle at 84% 12%, rgba(217, 143, 183, 0.4), transparent 28%),
    linear-gradient(145deg, #171411 0%, #2f6f5e 58%, #9a6a2f 100%);
  box-shadow: 0 36px 90px rgba(47, 41, 32, 0.22);
  animation: card-rise 0.72s ease both;
}

.object-card::before {
  content: "";
  position: absolute;
  inset: 22px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 26px;
}

.object-chip {
  position: absolute;
  top: 26px;
  left: 26px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.object-card strong {
  position: relative;
  font-size: 34px;
  line-height: 1.1;
  letter-spacing: -0.05em;
}

.object-card p {
  position: relative;
  margin: 14px 0 0;
  color: rgba(255, 255, 255, 0.78);
  font-size: 15px;
  line-height: 1.8;
}

.nfc-card {
  position: absolute;
  z-index: 3;
  right: 4%;
  bottom: 14%;
  display: grid;
  gap: 2px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  background: rgba(255, 250, 241, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 18px 48px rgba(47, 41, 32, 0.16);
}

.nfc-card span {
  color: var(--moss);
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.06em;
}

.nfc-card small {
  color: var(--muted);
  font-weight: 800;
}

.object-section,
.apps-section,
.os-section,
.final-cta {
  margin-top: 72px;
}

.section-head {
  max-width: 760px;
}

.section-head h2,
.apps-panel h2,
.os-copy h2,
.final-cta h2 {
  margin: 0;
  font-size: clamp(30px, 5vw, 54px);
  line-height: 1.08;
  letter-spacing: -0.07em;
}

.section-head span,
.os-copy p {
  display: block;
  margin-top: 16px;
  color: var(--muted);
  font-size: 16px;
  line-height: 1.85;
}

.object-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 28px;
}

.physical-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(30, 26, 23, 0.1);
  border-radius: 30px;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 18px 50px rgba(47, 41, 32, 0.06);
}

.physical-card img {
  width: 100%;
  aspect-ratio: 1.08;
  display: block;
  object-fit: cover;
}

.physical-card div {
  padding: 20px;
}

.physical-card span,
.light-app-card small {
  color: var(--moss);
  font-size: 12px;
  font-weight: 950;
}

.physical-card h3 {
  margin: 6px 0 8px;
  font-size: 24px;
  letter-spacing: -0.05em;
}

.physical-card p,
.light-app-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.75;
}

.apps-panel {
  padding: clamp(24px, 5vw, 46px);
  border-radius: 38px;
  color: #fff;
  background:
    radial-gradient(circle at 12% 12%, rgba(255, 255, 255, 0.22), transparent 28%),
    linear-gradient(135deg, #171411, #2f4f47 56%, #2f6f5e);
  box-shadow: 0 30px 80px rgba(47, 41, 32, 0.18);
}

.section-head--light .eyebrow,
.section-head--light span {
  color: rgba(255, 255, 255, 0.7);
}

.app-list {
  display: grid;
  gap: 12px;
  margin-top: 30px;
}

.light-app-card {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  gap: 18px;
  align-items: center;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
}

.app-index {
  color: rgba(255, 255, 255, 0.42);
  font-size: 28px;
  font-weight: 950;
  letter-spacing: -0.08em;
}

.light-app-card strong {
  font-size: 20px;
  letter-spacing: -0.04em;
}

.light-app-card p {
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.72);
}

.light-app-card small {
  justify-self: end;
  padding: 7px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(255, 255, 255, 0.12);
}

.os-section {
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
  gap: 28px;
  align-items: start;
}

.principle-list {
  display: grid;
  gap: 12px;
}

.principle-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 18px;
  border: 1px solid rgba(30, 26, 23, 0.1);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.62);
}

.principle-item span {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--rose);
  box-shadow: 0 0 0 8px rgba(217, 143, 183, 0.12);
}

.principle-item:nth-child(2) span {
  background: var(--moss);
}

.principle-item:nth-child(3) span {
  background: var(--amber);
}

.principle-item p {
  margin: 0;
  color: #4f463f;
  font-size: 16px;
  line-height: 1.7;
}

.final-cta {
  padding: clamp(28px, 5vw, 52px);
  border: 1px solid rgba(30, 26, 23, 0.1);
  border-radius: 38px;
  text-align: center;
  background:
    radial-gradient(circle at 18% 0%, rgba(217, 143, 183, 0.18), transparent 28%),
    rgba(255, 255, 255, 0.6);
}

.final-cta p {
  margin: 0 0 12px;
  color: var(--moss);
  font-weight: 950;
}

.final-cta button {
  margin-top: 24px;
}

.landing-footer {
  max-width: 1180px;
  display: flex;
  justify-content: center;
  gap: 14px;
  margin: 0 auto;
  padding: 26px 24px 34px;
  color: #9a9289;
  font-size: 13px;
}

.landing-footer span {
  color: #5f574f;
  font-weight: 950;
}

.landing-footer a {
  color: inherit;
  text-decoration: none;
}

.landing-footer a:hover {
  color: var(--moss);
}

@keyframes orbit-breathe {
  0%,
  100% {
    transform: scale(0.98) rotate(0deg);
    opacity: 0.86;
  }

  50% {
    transform: scale(1.04) rotate(4deg);
    opacity: 1;
  }
}

@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(18px) rotate(-1deg);
  }

  to {
    opacity: 1;
    transform: translateY(0) rotate(0);
  }
}

@media (max-width: 900px) {
  main {
    padding: 22px 18px 54px;
  }

  .hero-section,
  .os-section {
    grid-template-columns: 1fr;
  }

  .hero-section {
    min-height: auto;
    padding-top: 36px;
  }

  .hero-object {
    min-height: 440px;
  }

  .object-grid {
    grid-template-columns: 1fr;
  }

  .physical-card {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
  }

  .physical-card img {
    height: 100%;
    aspect-ratio: auto;
  }
}

@media (max-width: 620px) {
  .hero-copy h1 {
    font-size: clamp(42px, 16vw, 68px);
  }

  .hero-sub {
    font-size: 15px;
  }

  .hero-object {
    min-height: 390px;
  }

  .object-card {
    min-height: 360px;
  }

  .nfc-card {
    right: 0;
    bottom: 6%;
  }

  .physical-card,
  .light-app-card {
    grid-template-columns: 1fr;
  }

  .physical-card img {
    height: auto;
    aspect-ratio: 1.08;
  }

  .light-app-card small {
    justify-self: start;
  }

  .landing-footer {
    flex-wrap: wrap;
  }
}
</style>
