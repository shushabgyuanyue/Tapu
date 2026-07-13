<script setup lang="ts">
import { inject, ref } from 'vue';
import { createUnbindAppeal } from '../api';
import NavBar from '../components/NavBar.vue';

const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const orderNo = ref('');
const token = ref('');
const reason = ref('');
const submitting = ref(false);
const resultMsg = ref('');
const resultError = ref(false);

const submit = async () => {
  resultMsg.value = '';
  resultError.value = false;

  if (!orderNo.value.trim()) {
    resultMsg.value = '请输入外部订单号';
    resultError.value = true;
    return;
  }

  submitting.value = true;
  const result = await createUnbindAppeal({
    order_no: orderNo.value.trim(),
    token: token.value.trim() || undefined,
    reason: reason.value.trim() || undefined,
  });
  submitting.value = false;

  if (result.error) {
    resultMsg.value = result.error;
    resultError.value = true;
    return;
  }

  resultMsg.value = '申诉已提交，官方会人工核验并处理解绑';
  toast?.show('申诉已提交', 2200, 'success');
  orderNo.value = '';
  token.value = '';
  reason.value = '';
};
</script>

<template>
  <div class="appeal-page">
    <NavBar />

    <main class="appeal-shell">
      <header class="appeal-head">
        <span>Appeal</span>
        <h1>订单号申诉解绑</h1>
        <p>如果 token 在运输中泄露并被抢先绑定，可在一个月内提交外部订单号，官方人工核验后处理解绑。</p>
      </header>

      <section class="appeal-card">
        <label>
          <span>外部订单号</span>
          <input v-model="orderNo" placeholder="例如 WM20260713ABCD1234" />
        </label>
        <label>
          <span>token（可选）</span>
          <input v-model="token" placeholder="如果你手上有 token，可以一起提交" />
        </label>
        <label>
          <span>说明（可选）</span>
          <textarea v-model="reason" placeholder="简单说明问题，例如 token 疑似运输途中泄露"></textarea>
        </label>

        <button :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : '提交申诉' }}</button>
        <p v-if="resultMsg" :class="['msg', { error: resultError }]">{{ resultMsg }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.appeal-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 10%, rgba(255, 200, 120, 0.28), transparent 30%),
    linear-gradient(180deg, #fffdf8 0%, #f5f0e8 100%);
  color: #211f1a;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.appeal-shell {
  max-width: 620px;
  margin: 0 auto;
  padding: 34px 24px 60px;
}

.appeal-head span {
  color: #a06a1d;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.appeal-head h1 {
  margin: 8px 0;
  font-size: clamp(28px, 5vw, 40px);
  font-weight: 950;
  letter-spacing: -0.04em;
}

.appeal-head p {
  margin: 0 0 22px;
  color: #766c5f;
  font-size: 14px;
  line-height: 1.7;
}

.appeal-card {
  display: grid;
  gap: 14px;
  padding: 22px;
  border: 1px solid rgba(90, 65, 30, 0.1);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 45px rgba(90, 65, 30, 0.08);
}

.appeal-card label {
  display: grid;
  gap: 7px;
  color: #655c50;
  font-size: 13px;
  font-weight: 800;
}

.appeal-card input,
.appeal-card textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #e8ded0;
  border-radius: 14px;
  background: #fff;
  color: #211f1a;
  font-size: 14px;
  outline: none;
}

.appeal-card textarea {
  min-height: 100px;
  resize: vertical;
}

.appeal-card input:focus,
.appeal-card textarea:focus {
  border-color: #b98132;
}

.appeal-card button {
  justify-self: start;
  padding: 12px 20px;
  border: none;
  border-radius: 14px;
  background: #211f1a;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.appeal-card button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.msg {
  margin: 0;
  color: #2e7d32;
  font-size: 13px;
}

.msg.error {
  color: #c62828;
}

@media (max-width: 640px) {
  .appeal-shell {
    padding: 24px 16px 44px;
  }
}
</style>
