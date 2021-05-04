import Vue from "vue";
import VueRouter, { RouteConfig } from "vue-router";
import Home from "../views/Home.vue";
import ReviewView from "../views/ReviewView.vue";
import WatchListView from "../views/WatchListView.vue";

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
];

const router = new VueRouter({
  routes,
});

export default router;
