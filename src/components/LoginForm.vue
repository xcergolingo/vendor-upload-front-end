<template>
  <div class="login-card">
    <img src="/site-logo.png" alt="Golingo" class="logo" />
    <h2>Vendor Portal Login</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="Email" required />
      <input v-model="password" type="password" placeholder="Password" required />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in...' : 'Login' }}
      </button>
    </form>
    <button class="secondary" @click="handleRegister" :disabled="loading">
      Register
    </button>
    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="authState.error" class="error">{{ authState.error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { authState, login, register } from '../services/auth';

const email = ref('');
const password = ref('');
const message = ref('');
const loading = ref(false);

function validate() {
  if (!email.value || !password.value) {
    message.value = 'Email and password are required.';
    return false;
  }
  return true;
}

async function handleLogin() {
  if (!validate()) return;
  loading.value = true;
  message.value = '';
  try {
    await login(email.value.trim(), password.value);
  } catch (err) {
    console.error(err);
    message.value = 'Login failed. Please check your credentials.';
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  if (!validate()) return;
  loading.value = true;
  message.value = '';
  try {
    await register(email.value.trim(), password.value);
    message.value = 'Registration successful. Please log in.';
  } catch (err) {
    console.error(err);
    message.value = 'Registration failed. Please try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-card {
  max-width: 400px;
  margin: 80px auto;
  padding: 32px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 10px 35px rgb(0 0 0 / 10%);
  text-align: center;
}

.logo {
  height: 48px;
  margin-bottom: 16px;
}

input {
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid #d1d3e2;
  border-radius: 4px;
  font-size: 1rem;
}

button {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 4px;
  background-color: #4e73df;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 10px;
}

button.secondary {
  background-color: #1cc88a;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  color: #1cc88a;
  margin-top: 8px;
}

.error {
  color: #e74a3b;
  margin-top: 8px;
}
</style>
