<script setup lang="ts">
import { inject, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { changePassword, getProfile, isLoggedIn } from '../api';
import NavBar from '../components/NavBar.vue';
import { userCopy } from '../copy';

const router = useRouter();
const toast = inject<{ show: (text: string, duration?: number, type?: string) => void }>('toast');

const profile = ref<any>(null);
const loading = ref(true);
const oldPwd = ref('');
const newPwd = ref('');
const confirmPwd = ref('');
const pwdMsg = ref('');
const pwdError = ref(false);

onMounted(async () => {
  if (!isLoggedIn()) {
    toast?.show(userCopy.account.loginRequiredToast, 2500, 'error');
    router.push('/');
    return;
  }

  loading.value = true;
  profile.value = await getProfile();
  loading.value = false;
});

const handleChangePassword = async () => {
  pwdMsg.value = '';
  pwdError.value = false;

  if (!oldPwd.value || !newPwd.value || !confirmPwd.value) {
    pwdMsg.value = userCopy.account.password.required;
    pwdError.value = true;
    return;
  }

  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = userCopy.account.password.mismatch;
    pwdError.value = true;
    return;
  }

  const data = await changePassword(oldPwd.value, newPwd.value);
  if (data.success) {
    pwdMsg.value = userCopy.account.password.success;
    pwdError.value = false;
    oldPwd.value = '';
    newPwd.value = '';
    confirmPwd.value = '';
  } else {
    pwdMsg.value = data.error || userCopy.account.password.failed;
    pwdError.value = true;
  }
};
</script>

<template>
  <div class="account-page">
    <NavBar />

    <main class="account-shell">
      <div class="account-heading">
        <span class="eyebrow">{{ userCopy.account.eyebrow }}</span>
        <h1>{{ userCopy.account.title }}</h1>
        <p>{{ userCopy.account.intro }}</p>
      </div>

      <div class="account-loading" v-if="loading">{{ userCopy.account.loading }}</div>

      <template v-else-if="profile">
        <section class="profile-card">
          <div class="profile-avatar">{{ profile.username?.slice(0, 1)?.toUpperCase() }}</div>
          <div>
            <h2>{{ profile.username }}</h2>
            <p>{{ profile.is_creator ? userCopy.account.creatorAccount : userCopy.account.normalAccount }}</p>
          </div>
        </section>

        <section class="settings-card">
          <div class="card-head">
            <h2>{{ userCopy.account.password.title }}</h2>
            <p>{{ userCopy.account.password.intro }}</p>
          </div>

          <form class="password-form" @submit.prevent="handleChangePassword">
            <label>
              <span>{{ userCopy.account.password.current }}</span>
              <input v-model="oldPwd" type="password" autocomplete="current-password" />
            </label>
            <label>
              <span>{{ userCopy.account.password.next }}</span>
              <input v-model="newPwd" type="password" autocomplete="new-password" />
            </label>
            <label>
              <span>{{ userCopy.account.password.confirm }}</span>
              <input v-model="confirmPwd" type="password" autocomplete="new-password" />
            </label>

            <button type="submit" class="submit-btn">{{ userCopy.account.password.save }}</button>
            <p v-if="pwdMsg" :class="['form-msg', { error: pwdError }]">{{ pwdMsg }}</p>
          </form>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 222, 190, 0.36), transparent 28%),
    linear-gradient(180deg, #fffdf9 0%, #f7f4ed 100%);
  color: #211f1a;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
}

.account-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 56px;
}

.account-heading {
  margin-bottom: 24px;
}

.eyebrow {
  display: inline-flex;
  margin-bottom: 8px;
  color: #9a6a28;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.account-heading h1 {
  margin: 0 0 8px;
  font-size: clamp(26px, 5vw, 38px);
  font-weight: 900;
  letter-spacing: -0.04em;
}

.account-heading p {
  margin: 0;
  max-width: 520px;
  color: #7d7568;
  font-size: 14px;
  line-height: 1.7;
}

.account-loading {
  padding: 48px 0;
  color: #9a9288;
  text-align: center;
}

.profile-card,
.settings-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(72, 55, 30, 0.09);
  border-radius: 22px;
  box-shadow: 0 18px 45px rgba(92, 65, 28, 0.08);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  margin-bottom: 18px;
}

.profile-avatar {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: #211f1a;
  color: #fff8ef;
  font-size: 22px;
  font-weight: 900;
}

.profile-card h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
}

.profile-card p {
  margin: 0;
  color: #8b8275;
  font-size: 13px;
}

.settings-card {
  padding: 22px;
}

.card-head h2 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 800;
}

.card-head p {
  margin: 0 0 18px;
  color: #8b8275;
  font-size: 13px;
  line-height: 1.6;
}

.password-form {
  display: grid;
  gap: 14px;
  max-width: 380px;
}

.password-form label {
  display: grid;
  gap: 7px;
  color: #61584d;
  font-size: 13px;
  font-weight: 700;
}

.password-form input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #e6ded2;
  border-radius: 14px;
  background: #fff;
  color: #211f1a;
  font-size: 14px;
  outline: none;
}

.password-form input:focus {
  border-color: #b88332;
  box-shadow: 0 0 0 3px rgba(184, 131, 50, 0.12);
}

.submit-btn {
  justify-self: start;
  padding: 12px 20px;
  border: none;
  border-radius: 14px;
  background: #211f1a;
  color: #fff8ef;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.submit-btn:hover {
  transform: translateY(-1px);
}

.form-msg {
  margin: 0;
  color: #2e7d32;
  font-size: 12px;
}

.form-msg.error {
  color: #c62828;
}

@media (max-width: 640px) {
  .account-shell {
    padding: 24px 16px 42px;
  }

  .profile-card,
  .settings-card {
    border-radius: 18px;
  }
}
</style>
