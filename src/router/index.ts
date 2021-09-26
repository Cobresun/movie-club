import Vue from "vue";
import VueRouter, { RouteConfig } from "vue-router";
import Home from "../views/Home.vue";
import ReviewView from "../views/ReviewView.vue";
import WatchListView from "../views/WatchListView.vue";
import StatisticsView from "../views/StatisticsView.vue";

Vue.use(VueRouter);

const routes: Array<RouteConfig> = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/reviews",
    name: "Reviews",
    component: ReviewView,
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
