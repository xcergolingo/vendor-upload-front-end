import { createRouter, createWebHistory } from 'vue-router';
import DashboardView from '../views/DashboardView.vue';
import VideoDetailView from '../views/VideoDetailView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView
    },
    {
      path: '/videos/:fileName',
      name: 'video-detail',
      component: VideoDetailView,
      props: route => ({
        fileName: route.params.fileName,
        videoUrl: route.query.url || ''
      })
    }
  ]
});

export default router;
