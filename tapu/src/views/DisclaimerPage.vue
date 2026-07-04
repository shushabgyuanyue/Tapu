<script setup lang="ts">
import NavBar from '../components/NavBar.vue';
</script>

<template>
  <div class="legal-page">
    <NavBar />
    <div class="legal-content">
      <h1>免责声明</h1>
      <p class="legal-date">最后更新：2024年</p>

      <section>
        <h2>1. 平台性质</h2>
        <p>whatmint 是一个基于 NFC 实体与数字内容结合的情绪表达社区平台。平台为用户提供内容创作、分享、交互及实体绑定等服务。</p>
      </section>

      <section>
        <h2>2. 用户生成内容</h2>
        <p>用户在平台上传和发布的内容（包括但不限于视频、文字、图像）由用户自行负责。平台不对用户生成内容的真实性、合法性或适当性承担责任。如用户内容涉及侵权或违法行为，平台有权在接到通知后予以删除。</p>
      </section>

      <section>
        <h2>3. NFC 实体产品</h2>
        <p>whatmint NFC 实体产品为数字内容的物理载体。实体产品一经售出，因产品本身性质不支持无理由退换。实体产品的 NFC 功能依赖用户设备的兼容性，平台不保证所有设备均可正常读取。</p>
      </section>

      <section>
        <h2>4. 服务可用性</h2>
        <p>平台将尽力保证服务的持续稳定，但不对因网络故障、系统维护、不可抗力等因素导致的服务中断承担责任。平台保留在不另行通知的情况下修改、暂停或终止部分或全部服务的权利。</p>
      </section>

      <section>
        <h2>5. 知识产权</h2>
        <p>用户上传的原创内容，其知识产权归用户所有。用户授予平台在服务范围内展示、传播该内容的非独占许可。平台自有的品牌标识、界面设计等受知识产权法律保护。</p>
      </section>

      <section>
        <h2>6. 责任限制</h2>
        <p>在法律允许的最大范围内，平台对因使用或无法使用服务而产生的任何直接、间接、附带或后果性损害不承担责任。</p>
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
.legal-content p { font-size: 14px; color: #555; line-height: 1.8; margin: 0; }
</style>
