import Vue from "vue"
import VueRouter, { RouteConfig } from "vue-router"
import ClubHomeView from "../views/ClubHomeView.vue"
import ReviewView from "../views/ReviewView.vue"
import ReviewsGalleryView from "../views/ReviewsGalleryView.vue"
import WatchListView from "../views/WatchListView.vue"
import StatisticsView from "../views/StatisticsView.vue"
import ClubsView from "../views/ClubsView.vue"

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
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

const router = new VueRouter({
  routes,
  mode: 'history',
});

export default router;
