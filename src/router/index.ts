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
    meta: {
      depth: 0,
    }
  },
  {
    path: "/club/:clubId",
    name: "ClubHome",
    component: ClubHomeView,
    meta: {
      depth: 1,
    }
  },
  {
    path: "/club/:clubId/reviews",
    name: "Reviews",
    component: ReviewView,
    meta: {
      depth: 2,
    }
  },
  {
    path: "/club/:clubId/reviews-gallery",
    name: "ReviewsGallery",
    component: ReviewsGalleryView,
    meta: {
      depth: 2,
    }
  },
  {
    path: "/club/:clubId/watch-list",
    name: "WatchList",
    component: WatchListView,
    meta: {
      depth: 2,
    }
  },
  {
    path: "/club/:clubId/statistics",
    name: "Statistics",
    component: StatisticsView,
    meta: {
      depth: 2,
    }
  },
];

const router = createRouter({
  routes,
  history: createWebHistory(),
});

router.beforeEach((to, from) => {
  if (!from.name) {
    to.meta.transitionIn = "animate__animated animate__faster animate__fadeIn"
    return;
  }
  const slideInRight = "animate__animated animate__faster animate__slideInRight";
  const slideInLeft = "animate__animated animate__faster animate__slideInLeft";
  const slideOutRight = "animate__animated animate__faster animate__slideOutRight";
  const slideOutLeft = "animate__animated animate__faster animate__slideOutLeft";
  to.meta.transitionIn = to.meta.depth > from.meta.depth ? slideInRight : slideInLeft;
  to.meta.transitionOut = to.meta.depth > from.meta.depth ? slideOutLeft : slideOutRight;
})

export default router;
