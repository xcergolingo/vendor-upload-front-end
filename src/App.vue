<template>
  <div class="app">
    <div v-if="authState.loading" class="loading">Loading...</div>
    <LoginForm v-if="!authState.loading && !authState.isAuthenticated" />
    <div v-if="authState.isAuthenticated" class="shell">
      <MainNav :user-email="authState.userEmail" @logout="handleLogout" />
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import LoginForm from './components/LoginForm.vue';
import MainNav from './components/MainNav.vue';
import { authState, logout } from './services/auth';

const router = useRouter();

function handleLogout() {
  logout();
  router.push('/');
}
</script>

<style>
/* Global styles to prevent horizontal scroll */
html, body {
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
  touch-action: pan-y;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  background-color: #f8f9fa;
  overflow-x: hidden;
}

.loading {
  margin: 80px auto;
  text-align: center;
  font-size: 1.2rem;
  color: #4e73df;
}

.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.content {
  flex: 1;
  padding: 24px;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
</style>
