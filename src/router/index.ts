import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import ReviewView from '../views/ReviewView.vue'
import WatchListView from '../views/WatchListView.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/reviews',
    name: 'Reviews',
    component: ReviewView
  },
  {
    path: '/watchList',
    name: 'WatchList',
    component: WatchListView
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
