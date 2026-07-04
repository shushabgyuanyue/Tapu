<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { isLoggedIn, clearToken, getProfile } from '../api';
import LoginModal from './LoginModal.vue';

const router = useRouter();
const showLogin = ref(false);
const username = ref('');
const showDropdown = ref(false);

const checkAuth = async () => {
  if (isLoggedIn()) {
    try {
      const profile = await getProfile();
      if (profile && profile.username) {
        username.value = profile.username;
      }
    } catch {
      username.value = '';
    }
  }
};

const logout = () => {
  clearToken();
  username.value = '';
  showDropdown.value = false;
  router.push('/');
};

const openLogin = () => {
  showLogin.value = true;
};

const onLoginSuccess = (user: { username: string }) => {
  username.value = user.username;
  showLogin.value = false;
};

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
};

const closeDropdown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.nav-avatar-wrap')) {
    showDropdown.value = false;
  }
};

onMounted(() => {
  checkAuth();
  document.addEventListener('click', closeDropdown);
});
onUnmounted(() => {
  document.removeEventListener('click', closeDropdown);
});

defineExpose({ openLogin });
</script>

<template>
  <header class="navbar">
    <div class="navbar-inner">
      <router-link to="/" class="navbar-brand">whatmint</router-link>
      <nav class="navbar-links">
        <router-link to="/community" class="nav-link">社区</router-link>
        <router-link to="/wishlist" class="nav-link nav-link--wishlist" aria-label="心愿单">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
        </router-link>
        <router-link to="/admin" class="nav-link nav-link--creator">创作者</router-link>
        <router-link v-if="username === 'admin'" to="/official" class="nav-link nav-link--official">官方管理</router-link>
      </nav>
      <div class="navbar-auth">
        <div v-if="username" class="nav-avatar-wrap" @click.stop="toggleDropdown">
          <button class="nav-avatar" :title="username">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
          </button>
          <Transition name="dropdown">
            <div v-if="showDropdown" class="nav-dropdown">
              <div class="dropdown-user">{{ username }}</div>
              <router-link to="/account" class="dropdown-item" @click="showDropdown = false">账户设置</router-link>
              <button class="dropdown-item dropdown-item--danger" @click="logout">退出登录</button>
            </div>
          </Transition>
        </div>
        <button v-else class="nav-login-btn" @click="openLogin">登录</button>
      </div>
    </div>
  </header>

  <!-- Login Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showLogin" class="login-mask" @click.self="showLogin = false">
        <LoginModal @success="onLoginSuccess" @close="showLogin = false" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.navbar {
  position: sticky; top: 0;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid #f0f0f0; z-index: 100;
}
.navbar-inner {
  max-width: 960px; margin: 0 auto;
  display: flex; align-items: center;
  padding: 12px 24px; gap: 20px;
}
.navbar-brand {
  font-size: 18px; font-weight: 800; color: #1a1a1a;
  text-decoration: none; letter-spacing: -0.5px;
}
.navbar-links {
  display: flex; gap: 6px; flex: 1;
}
.nav-link {
  font-size: 13px; color: #666; text-decoration: none;
  padding: 6px 12px; border-radius: 8px;
  transition: background 0.12s, color 0.12s;
}
.nav-link:hover { background: #f5f5f5; color: #333; }
.nav-link.router-link-active { color: #7c4dff; background: #f8f5ff; }
.nav-link--wishlist { display: flex; align-items: center; padding: 6px 10px; }
.nav-link--creator { color: #7c4dff; border: 1px solid #ede7ff; }
.nav-link--creator:hover { background: #f8f5ff; }
.nav-link--official { color: #e69c00; border: 1px solid #fff0d4; }
.nav-link--official:hover { background: #fffaf0; }

.navbar-auth { display: flex; align-items: center; }

.nav-avatar-wrap { position: relative; }
.nav-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  border: 1.5px solid #e8e8e8; background: #f9f9f9;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  color: #666;
}
.nav-avatar:hover { border-color: #7c4dff; background: #f8f5ff; color: #7c4dff; }

.nav-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  background: #fff; border: 1px solid #f0f0f0;
  border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  min-width: 150px; overflow: hidden; z-index: 200;
}
.dropdown-user {
  padding: 12px 16px 8px; font-size: 13px; font-weight: 600;
  color: #333; border-bottom: 1px solid #f5f5f5;
}
.dropdown-item {
  display: block; width: 100%; padding: 10px 16px;
  font-size: 13px; color: #555; text-decoration: none;
  border: none; background: none; text-align: left;
  cursor: pointer; transition: background 0.12s;
}
.dropdown-item:hover { background: #f8f8f8; }
.dropdown-item--danger { color: #e53935; }
.dropdown-item--danger:hover { background: #fff5f5; }

.dropdown-enter-active { transition: all 0.15s ease-out; }
.dropdown-leave-active { transition: all 0.1s ease-in; }
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0; transform: translateY(-4px) scale(0.96);
}

.nav-login-btn {
  font-size: 13px; font-weight: 500; color: #fff;
  background: #7c4dff; border: none; border-radius: 8px;
  padding: 7px 16px; cursor: pointer;
  transition: opacity 0.12s;
}
.nav-login-btn:hover { opacity: 0.85; }

.login-mask {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}

.modal-enter-active { transition: opacity 0.25s ease; }
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 640px) {
  .navbar-inner { padding: 10px 16px; gap: 12px; }
  .navbar-brand { font-size: 16px; }
  .nav-link { font-size: 12px; padding: 5px 8px; }
  .nav-login-btn { padding: 6px 12px; font-size: 12px; }
  .nav-avatar { width: 30px; height: 30px; }
}
</style>
