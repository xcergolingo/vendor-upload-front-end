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
    <div class="button-row">
      <button class="secondary" @click="handleRegister" :disabled="loading">
        Register
      </button>
      <button class="tertiary" @click="handleForgotPassword" :disabled="loading">
        Forgot Password
      </button>
    </div>
    <p v-if="message" class="message" :class="{ success: isSuccess }">{{ message }}</p>
    <p v-if="authState.error" class="error">{{ authState.error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { authState, login, register, resetPassword } from '../services/auth';

const email = ref('');
const password = ref('');
const message = ref('');
const loading = ref(false);
const isSuccess = ref(false);

function validate() {
  if (!email.value || !password.value) {
    message.value = 'Email and password are required.';
    isSuccess.value = false;
    return false;
  }
  return true;
}

function validateEmail() {
  if (!email.value) {
    message.value = 'Please enter your email address.';
    isSuccess.value = false;
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
    isSuccess.value = false;
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
    isSuccess.value = true;
  } catch (err) {
    console.error(err);
    message.value = 'Registration failed. Please try again.';
    isSuccess.value = false;
  } finally {
    loading.value = false;
  }
}

async function handleForgotPassword() {
  if (!validateEmail()) return;
  loading.value = true;
  message.value = '';
  try {
    await resetPassword(email.value.trim());
    message.value = 'Password reset email sent! Check your inbox.';
    isSuccess.value = true;
  } catch (err) {
    console.error(err);
    message.value = 'Failed to send reset email. Please try again.';
    isSuccess.value = false;
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

.button-row {
  display: flex;
  gap: 10px;
}

.button-row button {
  flex: 1;
}

button.secondary {
  background-color: #1cc88a;
}

button.tertiary {
  background-color: #858796;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  color: #e74a3b;
  margin-top: 8px;
}

.message.success {
  color: #1cc88a;
}

.error {
  color: #e74a3b;
  margin-top: 8px;
}
</style>
