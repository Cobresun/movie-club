import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import ClubHomeView from "../views/ClubHomeView.vue"
import ReviewView from "../views/ReviewView.vue"
import ReviewsGalleryView from "../views/ReviewsGalleryView.vue"
import WatchListView from "../views/WatchListView.vue"
import StatisticsView from "../views/StatisticsView.vue"
import ClubsView from "../views/ClubsView.vue"

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Clubs",
    component: ClubsView,
  },
  {
    path: "/clubHome",
    name: "Club Home",
    component: ClubHomeView,
  },
  {
    path: "/reviews",
    name: "Reviews",
    component: ReviewView,
  },
  {
    path: "/reviews-gallery",
    name: "Reviews-Gallery",
    component: ReviewsGalleryView,
  },
  {
    path: "/watchList",
    name: "WatchList",
    component: WatchListView,
  },
  {
    path: "/statistics",
    name: "Statistics",
    component: StatisticsView,
  },
];

export default createRouter({
  routes,
  history: createWebHistory(),
});
