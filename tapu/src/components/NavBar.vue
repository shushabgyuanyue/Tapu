<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { clearToken, getConfig, getProfile, isLoggedIn } from '../api';
import LoginModal from './LoginModal.vue';

const router = useRouter();
const showLogin = ref(false);
const username = ref('');
const showDropdown = ref(false);
const communityEnabled = ref(false);
const wishlistEnabled = ref(false);

const checkAuth = async () => {
  if (!isLoggedIn()) {
    username.value = '';
    return;
  }

  try {
    const profile = await getProfile();
    username.value = profile?.username || '';
  } catch {
    username.value = '';
  }
};

const loadFeatureFlags = async () => {
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
  loadFeatureFlags();
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
        <router-link to="/shop" class="nav-link" title="商城">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="nav-label">商城</span>
        </router-link>

        <router-link v-if="communityEnabled" to="/community" class="nav-link" title="社区">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
          <span class="nav-label">社区</span>
        </router-link>

        <router-link v-if="wishlistEnabled" to="/wishlist" class="nav-link" title="心愿单">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span class="nav-label">心愿单</span>
        </router-link>

        <router-link to="/admin" class="nav-link nav-link--creator" title="创作者">
          <span class="nav-label">创作者</span>
        </router-link>

        <router-link v-if="username === 'admin'" to="/official" class="nav-link nav-link--official" title="官方管理">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span class="nav-label">官方</span>
        </router-link>
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
              <router-link to="/assets" class="dropdown-item" @click="showDropdown = false">我的资产</router-link>
              <router-link to="/appeals" class="dropdown-item" @click="showDropdown = false">解绑申诉</router-link>
              <button class="dropdown-item dropdown-item--danger" @click="logout">退出登录</button>
            </div>
          </Transition>
        </div>

        <button v-else class="nav-login-btn" @click="openLogin">登录</button>
      </div>
    </div>
  </header>

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
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(31, 31, 31, 0.08);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.navbar-inner {
  max-width: 980px;
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 0 auto;
  padding: 12px 24px;
}

.navbar-brand {
  color: #1a1a1a;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.04em;
  text-decoration: none;
}

.navbar-links {
  display: flex;
  flex: 1;
  gap: 6px;
  min-width: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 10px;
  color: #666;
  font-size: 13px;
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
}

.nav-label {
  font-size: 12px;
  font-weight: 700;
}

.nav-link:hover {
  background: #f5f5f5;
  color: #333;
}

.nav-link.router-link-active {
  background: #f8f5ff;
  color: #7c4dff;
}

.nav-link--creator {
  border: 1px solid #ede7ff;
  color: #7c4dff;
}

.nav-link--creator:hover {
  background: #f8f5ff;
}

.nav-link--official {
  border: 1px solid #fff0d4;
  color: #c98200;
}

.nav-link--official:hover {
  background: #fffaf0;
}

.navbar-auth {
  display: flex;
  align-items: center;
}

.nav-avatar-wrap {
  position: relative;
}

.nav-avatar {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #e8e8e8;
  border-radius: 50%;
  background: #f9f9f9;
  color: #666;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}

.nav-avatar:hover {
  border-color: #7c4dff;
  background: #f8f5ff;
  color: #7c4dff;
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  min-width: 150px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.09);
}

.dropdown-user {
  padding: 12px 16px 8px;
  border-bottom: 1px solid #f5f5f5;
  color: #333;
  font-size: 13px;
  font-weight: 800;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: #555;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  transition: background 0.12s;
}

.dropdown-item:hover {
  background: #f8f8f8;
}

.dropdown-item--danger {
  color: #e53935;
}

.dropdown-item--danger:hover {
  background: #fff5f5;
}

.dropdown-enter-active {
  transition: all 0.15s ease-out;
}

.dropdown-leave-active {
  transition: all 0.1s ease-in;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.96);
}

.nav-login-btn {
  padding: 7px 16px;
  border: none;
  border-radius: 10px;
  background: #1a1a1a;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.nav-login-btn:hover {
  opacity: 0.86;
}

.login-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .navbar-inner {
    gap: 10px;
    padding: 10px 14px;
  }

  .navbar-brand {
    font-size: 16px;
  }

  .navbar-links {
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .navbar-links::-webkit-scrollbar {
    display: none;
  }

  .nav-link {
    flex-shrink: 0;
    padding: 5px 8px;
  }

  .nav-link svg {
    display: none;
  }

  .nav-avatar {
    width: 30px;
    height: 30px;
  }

  .nav-login-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>
