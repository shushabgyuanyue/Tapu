<script setup lang="ts">
import { ref, onMounted } from 'vue';

const visible = ref(false);
onMounted(() => {
  // Trigger entrance animations after mount
  requestAnimationFrame(() => { visible.value = true; });
});
</script>

<template>
  <div class="landing">
    <nav class="nav">
      <router-link to="/" class="nav-logo">whatmint</router-link>
      <div class="nav-right">
        <router-link to="/community" class="nav-link">发现</router-link>
        <router-link to="/admin" class="nav-link nav-link-accent">创作者</router-link>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-badge">永远系列 · NFC 情绪玩具</div>
      <h1 class="hero-title">
        what????<br/>what!!!!<br/>what...
      </h1>
      <p class="hero-sub">触碰。感受。铸造。</p>
      <p class="hero-desc">
        说不出口的关心，做成手边的小东西。<br class="hide-m"/>
        碰一下手机，属于你的那一刻就来了。<br class="hide-m"/>
        不用说话。你懂的。
      </p>
      <div class="hero-actions">
        <router-link to="/community" class="btn-primary">看看大家在感受什么</router-link>
        <router-link to="/admin" class="btn-ghost">成为创作者</router-link>
      </div>
    </section>

    <!-- Visual divider -->
    <div class="divider-wave"></div>

    <!-- IP showcase -->
    <section class="ip-section">
      <h2 class="section-label">永远系列</h2>
      <h3 class="section-title">那些没说出口的话，它都懂</h3>
      <p class="section-desc">它不是一只普通的玩具。<br/>它是那个你不用解释，碰一下就能瞬间心安的存在。</p>
      
      <div class="ip-carousel-wrapper" :class="{ 'anim-in': visible }">
        <div class="ip-carousel">
          <div class="ip-card anim-item" style="--i: 0">
            <div class="ip-img-box">
              <img src="../IPimg/永远系列-祈福小狗-合集.png" alt="祈福小狗" />
            </div>
            <div class="ip-card-content">
              <h4>祈福小狗</h4>
              <p>把最灵验的锦鲤好运，偷偷藏进这只小狗里。<br/>碰一下，好运就属于你。</p>
            </div>
          </div>
          <div class="ip-card anim-item" style="--i: 1">
            <div class="ip-img-box">
              <img src="../IPimg/永远系列-纸巾小狗-合集.png" alt="纸巾小狗" />
            </div>
            <div class="ip-card-content">
              <h4>纸巾小狗</h4>
              <p>眼泪掉下来之前，它已经准备好了纸巾。<br/>别怕，我一直在。</p>
            </div>
          </div>
          <div class="ip-card anim-item" style="--i: 2">
            <div class="ip-img-box">
              <img src="../IPimg/永远系列-守护小狗-合集.png" alt="守护小狗" />
            </div>
            <div class="ip-card-content">
              <h4>守护小狗</h4>
              <p>当全世界背过身去，它会坚定地站在你身前。<br/>做你最温柔的盔甲。</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Value Props -->
    <section class="how-section">
      <h2 class="section-label">触碰 · 感受 · 铸造</h2>
      <h3 class="section-title">一个平台，两种身份，同一个人</h3>
      <div class="value-grid">
        <div class="value-card">
          <div class="value-icon">📱</div>
          <h4>碰一下，你能得到</h4>
          <ul class="value-list">
            <li>NFC 碰触，全屏沉浸播放</li>
            <li>上滑切换同系列内容，刷不完</li>
            <li>双击设为默认，下次碰就是它</li>
            <li>二创入口：换成你自己的角色</li>
          </ul>
        </div>
        <div class="value-card">
          <div class="value-icon">🎬</div>
          <h4>上传内容，你能获得</h4>
          <ul class="value-list">
            <li>作品被实体 IP 选中 → 持续分成</li>
            <li>社区点赞/收藏/分享 = 内容价值凭证</li>
            <li>热门作品铸造成玩具，进入线下渠道</li>
            <li>创作者 = 消费者，你给别人碰的也是你做的</li>
          </ul>
        </div>
      </div>
      <div class="flow" :class="{ 'anim-in': visible }">
        <div class="flow-step anim-item" style="--i: 3">
          <div class="step-num">01</div>
          <div class="step-body">
            <h4>上传一段共鸣</h4>
            <p>15 秒竖屏视频，表达一种关系、一个态度</p>
          </div>
        </div>
        <div class="flow-step anim-item" style="--i: 4">
          <div class="step-num">02</div>
          <div class="step-body">
            <h4>社区投票，数据说话</h4>
            <p>点赞/收藏/设为默认的数据决定哪些内容最有共鸣</p>
          </div>
        </div>
        <div class="flow-step anim-item" style="--i: 5">
          <div class="step-num">03</div>
          <div class="step-body">
            <h4>热门内容铸造成实体</h4>
            <p>被选中的作品做成 NFC 玩具，创作者获得持续收益</p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta">
      <h2 class="cta-title">你也有那个想说又说不出的瞬间吧</h2>
      <p class="cta-desc">把它做成内容，让它碰一下就被感受到。让共鸣从屏幕走进生活。</p>
      <div class="cta-btns">
        <router-link to="/admin" class="btn-primary btn-lg">铸造你的内容</router-link>
        <router-link to="/community" class="btn-ghost btn-lg">逛逛社区</router-link>
      </div>
      <p class="cta-upcoming">即将推出：城市系列 — 生活态度 × 文创联名</p>
    </section>

    <footer class="footer">
      <span class="footer-brand">whatmint</span>
      <span class="footer-sep">·</span>
      <span>触碰即铸造</span>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background: #fefefe;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

/* Nav */
.nav {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 32px; max-width: 1080px; margin: 0 auto;
}
.nav-logo { font-size: 22px; font-weight: 900; color: #1a1a1a; text-decoration: none; letter-spacing: -1px; }
.nav-right { display: flex; gap: 6px; }
.nav-link {
  font-size: 13px; color: #888; text-decoration: none;
  padding: 7px 16px; border-radius: 8px; transition: all 0.15s;
}
.nav-link:hover { color: #333; background: #f5f5f5; }
.nav-link-accent { color: #7c4dff; border: 1px solid #ede7ff; }
.nav-link-accent:hover { background: #f8f5ff; }

/* Hero */
.hero {
  text-align: center; padding: 100px 24px 80px; max-width: 720px; margin: 0 auto;
}
.hero-badge {
  display: inline-block; padding: 6px 16px; border-radius: 99px;
  background: linear-gradient(135deg, #f8f5ff, #ede7ff); color: #7c4dff;
  font-size: 12px; font-weight: 600; margin-bottom: 28px; letter-spacing: 0.5px;
}
.hero-title {
  font-size: clamp(36px, 9vw, 64px); font-weight: 900;
  line-height: 1.15; letter-spacing: -2px; margin: 0 0 16px;
  background: linear-gradient(135deg, #1a1a1a 0%, #444 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  background-clip: text;
}
.hero-sub {
  font-size: 18px; font-weight: 600; color: #7c4dff;
  letter-spacing: 4px; margin: 0 0 20px;
}
.hero-desc { font-size: 17px; color: #666; line-height: 1.9; margin: 0 0 40px; }
.hide-m { display: inline; }
.hero-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; }

/* Buttons */
.btn-primary {
  display: inline-block; padding: 14px 32px;
  background: linear-gradient(135deg, #7c4dff, #651fff); color: #fff;
  border-radius: 12px; font-weight: 600; font-size: 14px; text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 20px rgba(124, 77, 255, 0.3);
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(124, 77, 255, 0.4); }
.btn-ghost {
  display: inline-block; padding: 14px 32px;
  border: 1.5px solid #e0e0e0; color: #555; border-radius: 12px;
  font-size: 14px; font-weight: 500; text-decoration: none; transition: all 0.15s;
}
.btn-ghost:hover { border-color: #bbb; color: #222; background: #fafafa; }
.btn-lg { padding: 16px 40px; font-size: 15px; }

/* Divider */
.divider-wave {
  height: 80px;
  background: linear-gradient(180deg, #fefefe 0%, #f8f5ff 100%);
}

/* IP Section */
.ip-section { padding: 60px 24px 100px; max-width: 1080px; margin: 0 auto; }
.section-label {
  text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 2px; color: #7c4dff; margin: 0 0 12px;
}
.section-title {
  text-align: center; font-size: clamp(24px, 5vw, 36px); font-weight: 800;
  letter-spacing: -1px; margin: 0 0 12px;
}
.section-desc { text-align: center; color: #888; font-size: 15px; line-height: 1.7; margin: 0 0 48px; }

.ip-carousel-wrapper {
  width: 100%;
  overflow: hidden;
  padding: 20px 0 40px;
}

.ip-carousel {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 0 24px 40px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* Firefox */
}
.ip-carousel::-webkit-scrollbar { display: none; } /* Chrome */

.ip-card {
  flex: 0 0 85%;
  max-width: 400px;
  scroll-snap-align: center;
  background: #fff; border: 1px solid #f0f0f0; border-radius: 24px;
  padding: 0; text-align: left;
  transition: transform 0.25s, box-shadow 0.25s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.ip-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(124, 77, 255, 0.08); }

.ip-img-box {
  width: 100%;
  aspect-ratio: 1;
  background: #fcfcfc;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.ip-visual-lg {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.5s ease;
}
.ip-card:hover .ip-visual-lg { transform: scale(1.05); }

.ip-card-content {
  padding: 28px 24px;
}
.ip-card-content h4 { font-size: 20px; font-weight: 800; margin: 0 0 12px; color: #1a1a1a; letter-spacing: -0.5px; }
.ip-card-content p { font-size: 14px; color: #666; line-height: 1.8; margin: 0; }

/* How section */
.how-section {
  padding: 80px 24px 100px; max-width: 780px; margin: 0 auto;
  border-top: 1px solid #f0f0f0;
}

.value-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
  margin-bottom: 48px;
}
.value-card {
  background: #fff; border: 1px solid #f0f0f0; border-radius: 18px;
  padding: 28px 24px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.value-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(124, 77, 255, 0.06); }
.value-icon { font-size: 28px; margin-bottom: 12px; }
.value-card h4 { font-size: 15px; font-weight: 700; margin: 0 0 12px; }
.value-list { list-style: none; padding: 0; margin: 0; }
.value-list li {
  font-size: 13px; color: #666; line-height: 1.6;
  padding: 4px 0 4px 16px; position: relative;
}
.value-list li::before {
  content: ''; position: absolute; left: 0; top: 11px;
  width: 6px; height: 6px; border-radius: 50%;
  background: linear-gradient(135deg, #7c4dff, #b388ff);
}

.flow { margin-top: 0; }
.flow-step {
  display: flex; gap: 20px; padding: 24px 0;
  border-bottom: 1px solid #f5f5f5;
}
.flow-step:last-child { border-bottom: none; }
.step-num {
  font-size: 28px; font-weight: 900; color: #ede7ff;
  min-width: 48px; line-height: 1;
}
.step-body h4 { font-size: 15px; font-weight: 600; margin: 0 0 6px; }
.step-body p { font-size: 14px; color: #888; margin: 0; line-height: 1.6; }

/* CTA */
.cta {
  text-align: center; padding: 100px 24px;
  background: linear-gradient(180deg, #fefefe 0%, #f8f5ff 50%, #ede7ff 100%);
}
.cta-title { font-size: clamp(22px, 5vw, 32px); font-weight: 800; margin: 0 0 12px; letter-spacing: -0.5px; }
.cta-desc { color: #888; font-size: 15px; margin: 0 0 36px; }
.cta-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.cta-upcoming { margin-top: 32px; font-size: 12px; color: #bbb; letter-spacing: 0.5px; }

/* Footer */
.footer {
  text-align: center; padding: 32px; border-top: 1px solid #f0f0f0;
  font-size: 12px; color: #bbb; display: flex; justify-content: center; gap: 6px; align-items: center;
}
.footer-brand { font-weight: 700; color: #999; }
.footer-sep { color: #ddd; }

/* Stagger entrance animations */
.anim-item {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  transition-delay: calc(var(--i) * 100ms);
}
.anim-in .anim-item {
  opacity: 1;
  transform: translateY(0);
}

@media (max-width: 640px) {
  .hero { padding: 60px 20px 50px; }
  .hide-m { display: none; }
  .ip-grid { grid-template-columns: 1fr; gap: 16px; }
  .ip-section { padding: 40px 20px 60px; }
  .how-section { padding: 50px 20px 60px; }
  .value-grid { grid-template-columns: 1fr; }
  .cta { padding: 60px 20px; }
  .nav { padding: 16px 20px; }
  .hero-actions { flex-direction: column; align-items: center; }
}
</style>
