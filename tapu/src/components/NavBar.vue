<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { clearToken, getConfig, getProfile, isLoggedIn } from '../api';
import { commonCopy } from '../copy';
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
      <router-link to="/" class="navbar-brand">{{ commonCopy.brand }}</router-link>

      <nav class="navbar-links">
        <router-link to="/assets" class="nav-link nav-link--space" :title="commonCopy.nav.assets">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 7v7c0 4 3.5 6.5 8 7 4.5-.5 8-3 8-7V7l-8-4Z"/><path d="M9 12h6"/><path d="M12 9v6"/></svg>
          <span class="nav-label">{{ commonCopy.nav.assets }}</span>
        </router-link>

        <router-link to="/shop" class="nav-link" :title="commonCopy.nav.shop">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span class="nav-label">{{ commonCopy.nav.shop }}</span>
        </router-link>

        <router-link v-if="communityEnabled" to="/community" class="nav-link" :title="commonCopy.nav.community">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
          <span class="nav-label">{{ commonCopy.nav.community }}</span>
        </router-link>

        <router-link v-if="wishlistEnabled" to="/wishlist" class="nav-link" :title="commonCopy.nav.wishlist">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          <span class="nav-label">{{ commonCopy.nav.wishlist }}</span>
        </router-link>

        <router-link to="/mint" class="nav-link nav-link--creator" title="Mint Studio">
          <span class="nav-label">Mint Studio</span>
        </router-link>

        <router-link v-if="username === 'admin'" to="/official" class="nav-link nav-link--official" :title="commonCopy.nav.officialTitle">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <span class="nav-label">{{ commonCopy.nav.official }}</span>
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
              <router-link to="/assets" class="dropdown-item" @click="showDropdown = false">{{ commonCopy.nav.assets }}</router-link>
              <router-link to="/appeals" class="dropdown-item" @click="showDropdown = false">{{ commonCopy.nav.appeals }}</router-link>
              <router-link to="/account" class="dropdown-item" @click="showDropdown = false">{{ commonCopy.nav.account }}</router-link>
              <button class="dropdown-item dropdown-item--danger" @click="logout">{{ commonCopy.nav.logout }}</button>
            </div>
          </Transition>
        </div>

        <button v-else class="nav-login-btn" @click="openLogin">{{ commonCopy.nav.login }}</button>
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
  border-bottom: 1px solid var(--wm-line);
  background: rgba(255, 250, 247, 0.9);
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
  color: var(--wm-ink);
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
  border-radius: var(--wm-radius-sm);
  color: var(--wm-muted);
  font-size: 13px;
  text-decoration: none;
  transition: background var(--wm-duration-fast), color var(--wm-duration-fast);
}

.nav-label {
  font-size: 12px;
  font-weight: 700;
}

.nav-link:hover {
  background: var(--wm-surface-soft);
  color: var(--wm-ink);
}

.nav-link.router-link-active {
  background: var(--wm-accent-soft);
  color: var(--wm-accent);
}

.nav-link--creator {
  border: 1px solid var(--wm-line);
  color: var(--wm-accent);
}

.nav-link--space {
  border: 1px solid rgba(52, 197, 210, 0.24);
  color: var(--wm-ink);
}

.nav-link--space:hover {
  background: var(--wm-surface-soft);
}

.nav-link--creator:hover {
  background: var(--wm-accent-soft);
}

.nav-link--official {
  border: 1px solid var(--wm-line);
  color: var(--wm-gold);
}

.nav-link--official:hover {
  background: var(--wm-warm-soft);
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
  border: 1.5px solid var(--wm-line);
  border-radius: 50%;
  background: var(--wm-surface-solid);
  color: var(--wm-muted);
  cursor: pointer;
  transition: border-color var(--wm-duration-base), background var(--wm-duration-base), color var(--wm-duration-base);
}

.nav-avatar:hover {
  border-color: var(--wm-accent);
  background: var(--wm-accent-soft);
  color: var(--wm-accent);
}

.nav-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 200;
  min-width: 150px;
  overflow: hidden;
  border: 1px solid var(--wm-line);
  border-radius: var(--wm-radius-md);
  background: var(--wm-surface-solid);
  box-shadow: var(--wm-shadow-sm);
}

.dropdown-user {
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--wm-line-soft);
  color: var(--wm-ink);
  font-size: 13px;
  font-weight: 800;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: none;
  color: var(--wm-ink-soft);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  text-decoration: none;
  transition: background var(--wm-duration-fast);
}

.dropdown-item:hover {
  background: var(--wm-surface-soft);
}

.dropdown-item--danger {
  color: var(--wm-danger);
}

.dropdown-item--danger:hover {
  background: var(--wm-rose-soft);
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
  border-radius: var(--wm-radius-sm);
  background: var(--wm-ink);
  color: var(--wm-inverse);
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
  background: rgba(32, 27, 34, 0.42);
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
