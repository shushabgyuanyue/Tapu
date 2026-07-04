<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import NavBar from '../components/NavBar.vue';

const router = useRouter();
const activeSlide = ref(0);

const series = [
  {
    name: '永远系列',
    desc: '纸巾小狗 · 祈福小狗 · 守护小狗',
    img: new URL('../IPimg/永远系列-纸巾小狗-合集.png', import.meta.url).href,
  },
  {
    name: '城市系列',
    desc: '即将发布',
    img: new URL('../IPimg/永远系列-守护小狗-合集.png', import.meta.url).href,
  },
];

const nextSlide = () => { activeSlide.value = (activeSlide.value + 1) % series.length; };
const prevSlide = () => { activeSlide.value = (activeSlide.value - 1 + series.length) % series.length; };

let timer: ReturnType<typeof setInterval>;
onMounted(() => { timer = setInterval(nextSlide, 5000); });
onUnmounted(() => { clearInterval(timer); });
</script>

<template>
  <div class="landing">
    <NavBar />

    <!-- S1: 品牌宣言 -->
    <section class="s-hero">
      <div class="hero-inner">
        <h1 class="hero-headline">
          <span class="hero-line">IP即表达</span>
          <span class="hero-line">触碰即回应</span>
          <span class="hero-line">感受即铸造</span>
        </h1>
        <p class="hero-sub">一个让你的情绪变成可触碰实体的社区</p>
        <div class="hero-actions">
          <button class="btn-primary" @click="router.push('/community')">逛逛社区</button>
          <button class="btn-outline" @click="router.push('/wishlist')">心愿单</button>
        </div>
      </div>
    </section>

    <!-- S2: 产品大图滑动 -->
    <section class="s-products">
      <div class="products-inner">
        <div class="slider">
          <transition name="fade" mode="out-in">
            <div class="slide" :key="activeSlide">
              <div class="slide-visual">
                <img :src="series[activeSlide].img" :alt="series[activeSlide].name" />
              </div>
              <div class="slide-meta">
                <span class="slide-tag">{{ series[activeSlide].name }}</span>
                <p class="slide-desc">{{ series[activeSlide].desc }}</p>
                <button class="btn-wish" @click="router.push('/wishlist')">加入心愿单</button>
              </div>
            </div>
          </transition>

          <div class="slider-nav">
            <button class="s-arrow" @click="prevSlide">‹</button>
            <div class="s-dots">
              <span v-for="(_, i) in series" :key="i" class="s-dot" :class="{ on: i === activeSlide }" @click="activeSlide = i"></span>
            </div>
            <button class="s-arrow" @click="nextSlide">›</button>
          </div>
        </div>
      </div>
    </section>

    <!-- S3: 用户玩法 -->
    <section class="s-play">
      <div class="play-inner">
        <h2 class="sec-title">碰一下，得到专属回应</h2>
        <p class="sec-sub">每次触碰都是独一无二的情绪交互</p>

        <div class="play-steps">
          <div class="step">
            <div class="step-icon step-icon--tap">
              <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#7c4dff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="24" cy="14" r="4"/>
                <path d="M24 18v8"/>
                <path d="M20 30l4 6 4-6"/>
                <circle cx="24" cy="24" r="18" stroke-opacity="0.2"/>
                <circle cx="24" cy="24" r="18" class="pulse-ring"/>
              </svg>
            </div>
            <h3>触碰你的小狗</h3>
            <p>NFC 轻碰实体，它认出你来了</p>
          </div>
          <div class="step-divider"></div>
          <div class="step">
            <div class="step-icon step-icon--msg">
              <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#7c4dff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="8" y="12" width="32" height="22" rx="4"/>
                <path d="M16 22h8"/>
                <path d="M16 28h12"/>
                <circle cx="36" cy="12" r="4" fill="#ff4d6a" stroke="none" class="bounce-dot"/>
              </svg>
            </div>
            <h3>收到专属内容</h3>
            <p>每次碰触生成只属于你的视频回应</p>
          </div>
          <div class="step-divider"></div>
          <div class="step">
            <div class="step-icon step-icon--hug">
              <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#7c4dff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="16" r="4"/>
                <circle cx="30" cy="16" r="4"/>
                <path d="M10 36c0-6 4-10 8-10 2 0 4 1 6 3 2-2 4-3 6-3 4 0 8 4 8 10"/>
                <path d="M18 30c2 2 6 4 12 0" class="grow-path"/>
              </svg>
            </div>
            <h3>关系在生长</h3>
            <p>碰得越多，回应越懂你</p>
          </div>
        </div>
      </div>
    </section>

    <!-- S4: 社区玩法 -->
    <section class="s-community">
      <div class="community-inner">
        <h2 class="sec-title">为每一种感受创造内容</h2>
        <p class="sec-sub">态度、关系、情绪——都可以变成 IP</p>

        <div class="comm-grid">
          <div class="comm-card" @click="router.push('/admin')">
            <div class="comm-badge">创造</div>
            <h3>上传你的表达</h3>
            <p>一段情绪、一种态度、一种关系。系统帮你铸造成 IP。</p>
          </div>
          <div class="comm-card">
            <div class="comm-badge comm-badge--hot">精选</div>
            <h3>优秀内容成为IP</h3>
            <p>社区共鸣度高的作品，进入实体生产，成为可购买的小狗。</p>
          </div>
          <div class="comm-card">
            <div class="comm-badge comm-badge--gold">回报</div>
            <h3>共享价值分成</h3>
            <p>你创造的 IP 每被认领一次，你都会获得收益回响。</p>
          </div>
        </div>

        <button class="btn-comm" @click="router.push('/community')">去社区看看</button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="s-footer">
      <span class="footer-brand">whatmint</span>
      <span class="footer-sep">·</span>
      <span class="footer-slogan">碰一下，感受到了吗</span>
      <span class="footer-sep">·</span>
      <router-link to="/disclaimer" class="footer-link">免责声明</router-link>
      <router-link to="/privacy" class="footer-link">隐私政策</router-link>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  color: #1a1a1a;
}

/* S1: Hero */
.s-hero {
  padding: 80px 24px 64px;
  text-align: center;
}
.hero-inner {
  max-width: 600px;
  margin: 0 auto;
}
.hero-headline {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 20px;
}
.hero-line {
  font-size: clamp(28px, 6vw, 42px);
  font-weight: 900;
  letter-spacing: -1px;
  line-height: 1.3;
}
.hero-line:nth-child(1) { color: #1a1a1a; }
.hero-line:nth-child(2) { color: #7c4dff; }
.hero-line:nth-child(3) { color: #ff4d6a; }
.hero-sub {
  font-size: 15px;
  color: #999;
  margin: 0 0 32px;
  line-height: 1.6;
}
.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}
.btn-primary {
  background: #7c4dff;
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: #6b3ee8; }
.btn-outline {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #eee;
  padding: 12px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s;
}
.btn-outline:hover { border-color: #ccc; }

/* S2: Products Slider */
.s-products {
  padding: 0 24px 64px;
}
.products-inner {
  max-width: 720px;
  margin: 0 auto;
}
.slide {
  display: flex;
  align-items: center;
  gap: 32px;
  background: #f9f9f9;
  border-radius: 20px;
  padding: 24px;
  min-height: 280px;
}
.slide-visual {
  flex: 0 0 220px;
  height: 220px;
  border-radius: 16px;
  overflow: hidden;
  background: #f0f0f0;
}
.slide-visual img { width: 100%; height: 100%; object-fit: cover; }
.slide-meta { flex: 1; }
.slide-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: #7c4dff;
  background: #f3eeff;
  padding: 4px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
}
.slide-desc {
  font-size: 15px;
  color: #666;
  margin: 0 0 20px;
  line-height: 1.5;
}
.btn-wish {
  background: #ff4d6a;
  color: #fff;
  border: none;
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-wish:hover { background: #e6435d; }

.slider-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}
.s-arrow {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid #e8e8e8;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
  color: #666;
}
.s-arrow:hover { border-color: #7c4dff; color: #7c4dff; }
.s-dots { display: flex; gap: 6px; }
.s-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #ddd;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.s-dot.on { background: #7c4dff; transform: scale(1.4); }

.fade-enter-active { transition: all 0.35s ease; }
.fade-leave-active { transition: all 0.25s ease; }
.fade-enter-from { opacity: 0; transform: translateX(20px); }
.fade-leave-to { opacity: 0; transform: translateX(-20px); }

/* S3: Play */
.s-play {
  padding: 64px 24px;
  background: #f9f7ff;
  border-top: 1px solid #f0edf5;
}
.play-inner { max-width: 720px; margin: 0 auto; text-align: center; }
.sec-title {
  font-size: clamp(20px, 4vw, 26px);
  font-weight: 800;
  margin: 0 0 8px;
}
.sec-sub {
  font-size: 14px;
  color: #999;
  margin: 0 0 40px;
}
.play-steps {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
}
.step {
  flex: 1;
  max-width: 180px;
  text-align: center;
  padding: 0 12px;
}
.step-icon { font-size: 28px; margin-bottom: 12px; display: flex; justify-content: center; }
.step-icon svg { display: block; }
.step-icon--tap .pulse-ring {
  animation: pulse-ring 2s ease-in-out infinite;
  transform-origin: center;
}
@keyframes pulse-ring {
  0%, 100% { stroke-opacity: 0.15; transform: scale(1); }
  50% { stroke-opacity: 0.4; transform: scale(1.08); }
}
.step-icon--msg .bounce-dot {
  animation: bounce-dot 1.8s ease-in-out infinite;
}
@keyframes bounce-dot {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.step-icon--hug .grow-path {
  animation: grow-path 2.5s ease-in-out infinite;
  transform-origin: center;
}
@keyframes grow-path {
  0%, 100% { opacity: 0.5; transform: scaleX(0.9); }
  50% { opacity: 1; transform: scaleX(1.1); }
}
.step h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px;
}
.step p {
  font-size: 13px;
  color: #999;
  margin: 0;
  line-height: 1.5;
}
.step-divider {
  width: 32px;
  height: 1px;
  background: #e8e8e8;
  margin-top: 24px;
  flex-shrink: 0;
}

/* S4: Community */
.s-community {
  padding: 64px 24px;
}
.community-inner {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}
.comm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 32px;
  text-align: left;
}
.comm-card {
  padding: 22px 18px;
  border-radius: 14px;
  border: 1px solid #f0f0f0;
  background: #fff;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.comm-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.04);
}
.comm-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  color: #7c4dff;
  background: #f3eeff;
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 10px;
}
.comm-badge--hot { color: #ff4d6a; background: #fff0f3; }
.comm-badge--gold { color: #e69c00; background: #fff8e6; }
.comm-card h3 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 6px;
}
.comm-card p {
  font-size: 13px;
  color: #999;
  margin: 0;
  line-height: 1.6;
}
.btn-comm {
  background: #fff;
  color: #7c4dff;
  border: 1px solid #ede7ff;
  padding: 10px 28px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-comm:hover { background: #f8f5ff; }

/* Footer */
.s-footer {
  text-align: center;
  padding: 24px;
  border-top: 1px solid #f0f0f0;
  font-size: 12px;
  color: #bbb;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.footer-brand { font-weight: 700; color: #999; }
.footer-sep { color: #ddd; }
.footer-link { color: #bbb; text-decoration: none; transition: color 0.12s; }
.footer-link:hover { color: #7c4dff; }

/* Responsive */
@media (max-width: 640px) {
  .s-hero { padding: 60px 20px 48px; }

  .slide { flex-direction: column; gap: 20px; padding: 20px; min-height: auto; }
  .slide-visual { flex: none; width: 180px; height: 180px; margin: 0 auto; }
  .slide-meta { text-align: center; }

  .play-steps { flex-direction: column; gap: 24px; align-items: center; }
  .step-divider { width: 1px; height: 24px; margin: 0; }
  .step { max-width: none; }

  .comm-grid { grid-template-columns: 1fr; }
}
</style>
