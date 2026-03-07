<template>
  <nav class="main-nav">
    <div class="brand" @click="goHome">
      <img src="/site-logo.png" alt="Golingo" />
      <span>Golingo Vendor</span>
    </div>
    <div class="links">
      <RouterLink :to="{ name: 'dashboard', query: { tab: 'upload' } }">
        Upload Video
      </RouterLink>
      <RouterLink :to="{ name: 'dashboard', query: { tab: 'check' } }">
        Check Video
      </RouterLink>
      <RouterLink :to="{ name: 'dashboard', query: { tab: 'splits' } }">
        Video Splits
      </RouterLink>
    </div>
    <div class="user">
      <span class="email">{{ userEmail }}</span>
      <button @click="$emit('logout')">Logout</button>
    </div>
  </nav>
</template>

<script setup>
import { RouterLink, useRouter } from 'vue-router';

defineProps({
  userEmail: {
    type: String,
    required: true
  }
});

const router = useRouter();

function goHome() {
  router.push({ name: 'dashboard', query: { tab: 'upload' } });
}
</script>

<style scoped>
.main-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background-color: #343a40;
  color: #ffffff;
  flex-wrap: wrap;
  gap: 10px;
}

.brand {
  display: flex;
  align-items: center;
  font-weight: 600;
  cursor: pointer;
}

.brand img {
  height: 40px;
  margin-right: 12px;
}

.brand span {
  display: none;
}

.links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.links a {
  color: #ffffff;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.85rem;
  white-space: nowrap;
}

.links a.router-link-active {
  text-decoration: underline;
}

.user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.email {
  font-size: 0.8rem;
  opacity: 0.8;
  display: none;
}

button {
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #e74a3b;
  color: white;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

@media (min-width: 768px) {
  .main-nav {
    flex-wrap: nowrap;
  }

  .brand span {
    display: inline;
  }

  .links {
    gap: 20px;
  }

  .links a {
    font-size: 1rem;
  }

  .email {
    display: inline;
  }
}
</style>
