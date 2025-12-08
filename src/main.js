import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { initAuth } from './services/auth';
import './assets/base.css';

const app = createApp(App);

initAuth()
  .catch(err => {
    console.error('Failed to initialize auth', err);
  })
  .finally(() => {
    app.use(router).mount('#app');
  });
