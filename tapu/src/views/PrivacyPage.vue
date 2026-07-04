<script setup lang="ts">
import NavBar from '../components/NavBar.vue';
</script>

<template>
  <div class="legal-page">
    <NavBar />
    <div class="legal-content">
      <h1>隐私政策</h1>
      <p class="legal-date">最后更新：2024年</p>

      <section>
        <h2>1. 信息收集</h2>
        <p>我们收集以下类型的信息：</p>
        <ul>
          <li><strong>账户信息：</strong>注册时提供的用户名和加密存储的密码</li>
          <li><strong>匿名指纹：</strong>用于心愿单等功能的本地生成随机标识，不关联个人身份</li>
          <li><strong>NFC 交互数据：</strong>实体碰触产生的设备识别和播放记录</li>
          <li><strong>使用数据：</strong>内容浏览、点赞、收藏等交互行为的匿名统计</li>
        </ul>
      </section>

      <section>
        <h2>2. 信息用途</h2>
        <p>收集的信息用于：</p>
        <ul>
          <li>提供和改进平台服务</li>
          <li>个性化内容推荐和用户体验</li>
          <li>NFC 实体与数字内容的绑定和验证</li>
          <li>平台安全保障和异常行为检测</li>
        </ul>
      </section>

      <section>
        <h2>3. 信息存储</h2>
        <p>您的数据存储在安全的服务器上。密码经过单向加密处理，平台无法获取您的明文密码。我们采取合理的技术手段保护您的信息安全。</p>
      </section>

      <section>
        <h2>4. 信息共享</h2>
        <p>我们不会将您的个人信息出售给第三方。仅在以下情况可能共享信息：</p>
        <ul>
          <li>经您明确同意</li>
          <li>法律法规要求</li>
          <li>保护平台及用户的合法权益</li>
        </ul>
      </section>

      <section>
        <h2>5. 用户权利</h2>
        <p>您有权：</p>
        <ul>
          <li>访问和修改您的账户信息</li>
          <li>删除您发布的内容</li>
          <li>注销账户（请联系平台）</li>
        </ul>
      </section>

      <section>
        <h2>6. Cookie 与本地存储</h2>
        <p>我们使用浏览器本地存储（localStorage）保存登录状态和匿名指纹标识。这些数据仅存储在您的设备上，您可以随时通过清除浏览器数据将其删除。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh; background: #fefefe;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}
.legal-content {
  max-width: 640px; margin: 0 auto; padding: 32px 24px 80px;
}
.legal-content h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
.legal-date { font-size: 12px; color: #999; margin: 0 0 32px; }
.legal-content section { margin-bottom: 24px; }
.legal-content h2 { font-size: 15px; font-weight: 700; margin: 0 0 8px; }
.legal-content p { font-size: 14px; color: #555; line-height: 1.8; margin: 0 0 8px; }
.legal-content ul {
  padding-left: 20px; margin: 8px 0 0;
}
.legal-content li {
  font-size: 14px; color: #555; line-height: 1.8; margin-bottom: 4px;
}
</style>
