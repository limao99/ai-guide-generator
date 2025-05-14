import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/capture',
    name: 'Capture',
    component: () => import('../views/Capture.vue')
  },
  {
    path: '/guide',
    name: 'Guide',
    component: () => import('../views/Guide.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router; 