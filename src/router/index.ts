import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import { isDefined } from "../../lib/checks/checks.js";
import ClubHomeView from "../features/clubs/views/ClubHomeView.vue";
import ClubsView from "../features/clubs/views/ClubsView.vue";
import NewClubView from "../features/clubs/views/NewClubView.vue";
import ReviewView from "../features/reviews/views/ReviewView.vue";
import StatisticsView from "../features/statistics/StatisticsView.vue";
import WatchListView from "../features/watch-list/views/WatchListView.vue";

import AwardsView from "@/features/awards/views/AwardsView.vue";
import CategoriesView from "@/features/awards/views/CategoriesView.vue";
import NominationsView from "@/features/awards/views/NominationsView.vue";
import RankingsView from "@/features/awards/views/RankingsView.vue";
import ResultView from "@/features/awards/views/ResultView.vue";
import YearView from "@/features/awards/views/YearView.vue";
import ProfileView from "@/features/profile/views/ProfileView.vue";
import { useAuthStore } from "@/stores/auth";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Clubs",
    component: ClubsView,
    meta: {
      depth: 0,
    },
  },
  {
    path: "/profile",
    name: "Profile",
    component: ProfileView,
    beforeEnter: (to, from, next) => {
      const auth = useAuthStore();
      if (!auth.isLoggedIn) {
        next({ name: "Clubs" });
      } else {
        next();
      }
    },
    meta: {
      depth: 1,
      authRequired: true,
    },
  },
  {
    path: "/club/:clubId",
    name: "ClubHome",
    component: ClubHomeView,
    meta: {
      depth: 1,
    },
  },
  {
    path: "/newClub",
    name: "NewClub",
    component: NewClubView,
    meta: {
      depth: 1,
    },
  },
  {
    path: "/club/:clubId/reviews",
    name: "Reviews",
    component: ReviewView,
    props: true,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/watch-list",
    name: "WatchList",
    component: WatchListView,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/statistics",
    name: "Statistics",
    component: StatisticsView,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/awards",
    name: "Awards",
    component: AwardsView,
    meta: {
      depth: 2,
    },
    children: [
      {
        path: ":year",
        name: "AwardsYear",
        component: YearView,
        props: true,
        children: [
          {
            path: "categories",
            name: "AwardsCategories",
            props: true,
            component: CategoriesView,
          },
          {
            path: "nominations",
            name: "AwardsNominations",
            props: true,
            component: NominationsView,
          },
          {
            path: "rankings",
            name: "AwardsRankings",
            props: true,
            component: RankingsView,
          },
          {
            path: "results",
            name: "AwardsResults",
            props: true,
            component: ResultView,
          },
        ],
      },
    ],
  },
];

const router = createRouter({
  routes,
  history: createWebHistory(),
});

router.beforeEach((to, from) => {
  if (!isDefined(from.name)) {
    to.meta.transitionIn = "animate__animated animate__faster animate__fadeIn";
    return;
  }
  const slideInRight =
    "animate__animated animate__faster animate__slideInRight";
  const slideInLeft = "animate__animated animate__faster animate__slideInLeft";
  const slideOutRight =
    "animate__animated animate__faster animate__slideOutRight";
  const slideOutLeft =
    "animate__animated animate__faster animate__slideOutLeft";
  to.meta.transitionIn =
    to.meta.depth > from.meta.depth ? slideInRight : slideInLeft;
  to.meta.transitionOut =
    to.meta.depth > from.meta.depth ? slideOutLeft : slideOutRight;
});

export default router;
