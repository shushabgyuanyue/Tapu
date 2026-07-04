<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const isTouched = ref(false);

const handleTouch = () => {
  // Mobile vibration feedback
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
  isTouched.value = true;
  
  // Auto-hide feedback after a few seconds
  setTimeout(() => {
    isTouched.value = false;
  }, 2500);
};

const scrollToBuy = () => {
  const el = document.getElementById('buy-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};
</script>

<template>
  <div class="landing">
    <!-- Header -->
    <nav class="nav">
      <div class="nav-logo">whatmint</div>
      <div class="nav-links">
        <button class="nav-btn" @click="router.push('/community')">发现</button>
        <button class="nav-btn accent" @click="router.push('/admin')">创作者</button>
      </div>
    </nav>

    <!-- SECTION 1: Hero -->
    <section class="s-hero">
      <h1 class="hero-title">你一碰，<br/>它就会心疼你</h1>
      <p class="hero-sub">一个可以触碰的情绪小狗<br/>会递纸巾，会回应你</p>
      
      <div class="hero-visual" @click="handleTouch">
        <div class="dog-wrapper breathing" :class="{ 'is-touched': isTouched }">
          <img class="hero-img" src="../IPimg/永远系列-纸巾小狗-合集.png" alt="纸巾小狗" />
        </div>
        
        <transition name="float-up">
          <div v-if="isTouched" class="touch-feedback">
            <span class="fb-icon">✨</span>
            <div class="fb-text">
              <div class="fb-typing">“递出纸巾...”</div>
              <div class="fb-typing delay-1">“别怕，我一直在”</div>
              <div class="fb-typing delay-2">已记录你的情绪</div>
            </div>
          </div>
        </transition>
        <div v-else class="touch-hint">↑ 轻轻碰一下它</div>
      </div>

      <div class="hero-ctas">
        <button class="btn-primary" @click="router.push('/community')">触碰体验一下</button>
        <button class="btn-secondary" @click="scrollToBuy">立即拥有你的小狗</button>
      </div>
    </section>

    <!-- SECTION 2: Products -->
    <section class="s-products">
      <h2 class="section-title">三种会回应你的小狗</h2>
      
      <div class="scroll-row">
        <!-- Card 1 -->
        <div class="prod-card">
          <div class="prod-img-box">
            <div class="prod-tag">主爆款 🔥</div>
            <img src="../IPimg/永远系列-纸巾小狗-合集.png" alt="纸巾小狗"/>
          </div>
          <div class="prod-info">
            <h3>纸巾小狗</h3>
            <p>你难过时，它永远递纸巾</p>
            <button class="btn-buy-sm" @click="scrollToBuy">立即购买</button>
          </div>
        </div>
        <!-- Card 2 -->
        <div class="prod-card">
          <div class="prod-img-box">
            <img src="../IPimg/永远系列-祈福小狗-合集.png" alt="祈福小狗"/>
          </div>
          <div class="prod-info">
            <h3>祈福小狗</h3>
            <p>替你把愿望放在心里</p>
            <button class="btn-buy-sm" @click="scrollToBuy">立即购买</button>
          </div>
        </div>
        <!-- Card 3 -->
        <div class="prod-card">
          <div class="prod-img-box">
            <img src="../IPimg/永远系列-守护小狗-合集.png" alt="守护小狗"/>
          </div>
          <div class="prod-info">
            <h3>守护小狗</h3>
            <p>不说话，但一直在</p>
            <button class="btn-buy-sm" @click="scrollToBuy">立即购买</button>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 3: Mechanism -->
    <section class="s-mechanism">
      <h2 class="section-title">它为什么会懂你？</h2>
      <div class="mech-steps">
        <div class="mech-step">
          <div class="step-num">1</div>
          <div class="step-text">
            <h4>触碰绑定</h4>
            <p>NFC手机轻碰，认领你的专属小狗</p>
          </div>
        </div>
        <div class="mech-step">
          <div class="step-num">2</div>
          <div class="step-text">
            <h4>情绪记录</h4>
            <p>你的每一次触碰，它都会生成专属回应</p>
          </div>
        </div>
        <div class="mech-step">
          <div class="step-num">3</div>
          <div class="step-text">
            <h4>情绪反馈</h4>
            <p>不同的状态，给予你不同的治愈内容</p>
          </div>
        </div>
      </div>
      <div class="mech-core">
        <p>你不是在买摆件，<br/>你是在养一个情绪关系。</p>
      </div>
    </section>

    <!-- SECTION 4: Scenarios -->
    <section class="s-scenarios">
      <h2 class="section-title">它真的会回应你</h2>
      <div class="chat-list">
        <div class="chat-row">
          <div class="chat-q">今天有点累 🥺</div>
          <div class="chat-a">“要不要休息一下，靠着我”</div>
        </div>
        <div class="chat-row">
          <div class="chat-q">你笑了一下 ✨</div>
          <div class="chat-a">“我看到你开心了，真好”</div>
        </div>
        <div class="chat-row">
          <div class="chat-q">很久没有触碰 💭</div>
          <div class="chat-a">“我在等你，一直都在”</div>
        </div>
      </div>
    </section>

    <!-- SECTION 5: Creator System -->
    <section class="s-creator">
      <div class="creator-header">
        <h2 class="section-title">每一只小狗，<br/>都来自一个人类的情绪</h2>
        <p class="section-sub">你可以创造，也可以被看见</p>
      </div>
      
      <div class="creator-cards">
        <!-- Entry 1 -->
        <div class="c-card c-create" @click="router.push('/admin')">
          <div class="c-card-header">
            <h3>成为创作者</h3>
            <span class="icon-arrow">↗</span>
          </div>
          <ul class="c-list">
            <li>上传一句情绪 / 一个瞬间</li>
            <li>系统生成你的专属小狗</li>
            <li>自动进入社区进行共鸣投票</li>
          </ul>
          <button class="btn-create">开始创造你的小狗</button>
        </div>
        
        <!-- Entry 2 -->
        <div class="c-card c-selected">
          <h3>被选中的小狗</h3>
          <ul class="c-list">
            <li>社区投票产生“官方小狗”</li>
            <li>直接进入商品化实体生产</li>
            <li>创作者获得 <strong>收益分成 + 专属署名</strong></li>
          </ul>
        </div>

        <!-- Entry 3 -->
        <div class="c-card c-rank" @click="router.push('/community')">
          <h3>社区情绪榜单</h3>
          <div class="rank-tags">
            <span class="r-tag">🔥 本周最受欢迎情绪</span>
            <span class="r-tag">👑 霸榜爆款小狗</span>
            <span class="r-tag">📱 最多触碰的共鸣</span>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 6: Footer CTA -->
    <section class="s-footer" id="buy-section">
      <h2 class="section-title">选择你的第一只小狗</h2>
      <div class="buy-options">
        <button class="btn-option active">
          <span class="opt-name">纸巾小狗</span>
          <span class="opt-badge">主推</span>
        </button>
        <button class="btn-option">
          <span class="opt-name">祈福小狗</span>
        </button>
        <button class="btn-option">
          <span class="opt-name">守护小狗</span>
        </button>
      </div>
    </section>

    <!-- Sticky Bottom Bar -->
    <div class="sticky-bar">
      <button class="btn-sticky" @click="router.push('/wishlist')">
        立即拥有你的情绪小狗
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Base Variables & Reset */
.landing {
  --bg-color: #FDFBF7;
  --text-main: #1C1C1E;
  --text-sub: #8E8E93;
  --accent: #1C1C1E;
  --card-bg: #FFFFFF;
  --radius-lg: 24px;
  --radius-md: 16px;
  
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
  min-height: 100vh;
  padding-bottom: 120px; /* Space for sticky bar */
  overflow-x: hidden;
}

/* Typography */
.section-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: -0.5px;
  margin-bottom: 16px;
}

/* Nav */
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
}
.nav-logo {
  font-weight: 900;
  font-size: 20px;
  letter-spacing: -0.5px;
}
.nav-links {
  display: flex;
  gap: 12px;
}
.nav-btn {
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-sub);
  padding: 6px 12px;
}
.nav-btn.accent {
  color: var(--text-main);
  background: #F0EFEB;
  border-radius: 20px;
}

/* S1: Hero */
.s-hero {
  padding: 40px 24px 60px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-title {
  font-size: 40px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -1px;
  margin: 0 0 16px;
}
.hero-sub {
  font-size: 16px;
  color: var(--text-sub);
  line-height: 1.6;
  margin: 0 0 40px;
}
.hero-visual {
  position: relative;
  width: 280px;
  height: 280px;
  margin-bottom: 40px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.dog-wrapper {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, #F4F1EB 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.dog-wrapper.is-touched {
  transform: scale(0.92);
}
.hero-img {
  width: 85%;
  height: 85%;
  object-fit: cover;
  border-radius: 50%;
}
.breathing {
  animation: breathe 4s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.02); }
}

.touch-hint {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  color: var(--text-sub);
  background: rgba(255,255,255,0.8);
  padding: 4px 12px;
  border-radius: 20px;
  backdrop-filter: blur(4px);
  animation: bounce 2s infinite;
}
@keyframes bounce {
  0%, 100% { transform: translate(-50%, 0); }
  50% { transform: translate(-50%, 4px); }
}

.touch-feedback {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--card-bg);
  padding: 16px 20px;
  border-radius: var(--radius-md);
  box-shadow: 0 12px 40px rgba(0,0,0,0.1);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 240px;
  z-index: 10;
}
.fb-icon { font-size: 20px; }
.fb-text { text-align: left; }
.fb-typing {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-main);
  opacity: 0;
  animation: fadeIn 0.3s forwards;
}
.fb-typing:last-child { margin-bottom: 0; color: var(--text-sub); font-size: 12px; font-weight: 400; }
.delay-1 { animation-delay: 0.6s; }
.delay-2 { animation-delay: 1.2s; }
@keyframes fadeIn { to { opacity: 1; } }

.float-up-enter-active, .float-up-leave-active { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
.float-up-enter-from { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
.float-up-leave-to { opacity: 0; transform: translate(-50%, -10px) scale(0.95); }

.hero-ctas {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 320px;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 99px;
  padding: 18px 24px;
  font-size: 16px;
  font-weight: 700;
}
.btn-secondary {
  background: transparent;
  color: var(--text-main);
  border: 2px solid #EBE8E0;
  border-radius: 99px;
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 700;
}

/* S2: Products */
.s-products {
  padding: 60px 0 40px;
}
.s-products .section-title {
  padding: 0 24px;
}
.scroll-row {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  gap: 16px;
  padding: 10px 24px 40px;
  scrollbar-width: none;
}
.scroll-row::-webkit-scrollbar { display: none; }

.prod-card {
  flex: 0 0 80%;
  max-width: 300px;
  scroll-snap-align: center;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0,0,0,0.03);
  overflow: hidden;
}
.prod-img-box {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #F8F6F2;
  display: flex;
  align-items: center;
  justify-content: center;
}
.prod-img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.prod-tag {
  position: absolute;
  top: 16px;
  left: 16px;
  background: #FF4D6A;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 12px;
  z-index: 2;
}
.prod-info {
  padding: 24px;
}
.prod-info h3 { margin: 0 0 8px; font-size: 20px; font-weight: 800; }
.prod-info p { margin: 0 0 24px; font-size: 14px; color: var(--text-sub); }
.btn-buy-sm {
  width: 100%;
  background: #F4F2EF;
  border: none;
  padding: 12px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 14px;
  color: var(--text-main);
}

/* S3: Mechanism */
.s-mechanism {
  padding: 60px 24px;
  background: #FFF;
  border-radius: 40px;
  margin: 0 12px;
}
.mech-steps {
  margin: 32px 0 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.mech-step {
  display: flex;
  gap: 16px;
}
.step-num {
  width: 32px;
  height: 32px;
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
}
.step-text h4 { margin: 0 0 4px; font-size: 16px; font-weight: 700; }
.step-text p { margin: 0; font-size: 14px; color: var(--text-sub); }

.mech-core {
  background: #F8F6F2;
  padding: 24px;
  border-radius: var(--radius-md);
  text-align: center;
}
.mech-core p {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.6;
  color: var(--text-main);
}

/* S4: Scenarios */
.s-scenarios {
  padding: 80px 24px;
}
.chat-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 32px;
}
.chat-row { display: flex; flex-direction: column; gap: 8px; }
.chat-q {
  align-self: flex-start;
  background: #FFF;
  padding: 12px 20px;
  border-radius: 20px 20px 20px 4px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,0.03);
}
.chat-a {
  align-self: flex-end;
  background: var(--accent);
  color: #fff;
  padding: 12px 20px;
  border-radius: 20px 20px 4px 20px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(28,28,30,0.15);
}

/* S5: Creator */
.s-creator {
  padding: 0 24px 60px;
}
.creator-header { margin-bottom: 32px; }
.section-sub { font-size: 16px; color: var(--text-sub); margin-top: -8px; }

.creator-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.c-card {
  background: #FFF;
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.03);
}
.c-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.c-card h3 { margin: 0; font-size: 20px; font-weight: 800; }
.icon-arrow { font-size: 20px; color: var(--text-sub); }

.c-list {
  padding-left: 20px;
  margin: 0 0 24px;
  color: var(--text-sub);
  font-size: 14px;
  line-height: 1.8;
}
.c-list li { margin-bottom: 4px; }
.c-list strong { color: var(--accent); }

.btn-create {
  width: 100%;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 16px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 15px;
}
.c-selected {
  background: linear-gradient(135deg, #FDFBF7, #F4F1EB);
  border: 1px solid #EBE8E0;
}
.c-rank { cursor: pointer; }
.rank-tags {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}
.r-tag {
  background: #F4F2EF;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
}

/* S6: Footer */
.s-footer {
  padding: 40px 24px 60px;
  text-align: center;
}
.buy-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}
.btn-option {
  background: #FFF;
  border: 2px solid transparent;
  padding: 20px;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 700;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
}
.btn-option.active {
  border-color: var(--accent);
}
.opt-badge {
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 10px;
}

/* Sticky CTA */
.sticky-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 16px 24px 32px;
  background: linear-gradient(to top, rgba(253,251,247,1) 70%, rgba(253,251,247,0));
  display: flex;
  justify-content: center;
  z-index: 100;
}
.btn-sticky {
  width: 100%;
  max-width: 400px;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 20px;
  border-radius: 99px;
  font-size: 16px;
  font-weight: 800;
  box-shadow: 0 12px 30px rgba(28,28,30,0.2);
}
</style>
