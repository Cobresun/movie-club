import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import { isDefined } from "../../lib/checks/checks.js";
import type { ClubPreview } from "../../lib/types/club.ts";
import ClubHomeView from "../features/clubs/views/ClubHomeView.vue";
import ClubsView from "../features/clubs/views/ClubsView.vue";
import NewClubView from "../features/clubs/views/NewClubView.vue";
import ReviewView from "../features/reviews/views/ReviewView.vue";
import ClubSettingsView from "../features/settings/views/ClubSettingsView.vue";
import JoinClubView from "../features/settings/views/JoinClubView.vue";
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

const checkClubAccess = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const auth = useAuthStore();

  // Wait for auth initialization to complete
  while (auth.authLoading) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // If not logged in, redirect to clubs
  if (!auth.isLoggedIn) {
    next({ name: "Clubs" });
    return;
  }

  const clubId = to.params.clubId;
  const response = await auth.request.get<ClubPreview[]>("/api/member/clubs");
  const clubs = response.data;
  // TODO: fix this
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const isMember = clubs.some((club) => String(club.clubId) === clubId);
  if (isMember) {
    next();
    return;
  }
};

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
    path: "/share/club/:clubId/review/:workId",
    name: "SharedReview",
    component: () => import("../features/reviews/views/SharedReviewView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
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
    beforeEnter: checkClubAccess,
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
      authRequired: true,
    },
  },
  {
    path: "/club/:clubId/reviews",
    name: "Reviews",
    component: ReviewView,
    beforeEnter: checkClubAccess,
    props: true,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/watch-list",
    name: "WatchList",
    component: WatchListView,
    beforeEnter: checkClubAccess,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/statistics",
    name: "Statistics",
    component: StatisticsView,
    beforeEnter: checkClubAccess,
    meta: {
      depth: 2,
    },
  },
  {
    path: "/club/:clubId/awards",
    name: "Awards",
    component: AwardsView,
    beforeEnter: checkClubAccess,
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
  {
    path: "/club/:clubId/settings",
    name: "ClubSettings",
    component: ClubSettingsView,
    beforeEnter: checkClubAccess,
    meta: {
      depth: 2,
      authRequired: true,
    },
  },
  {
    path: "/join-club/:inviteToken",
    name: "JoinClub",
    component: JoinClubView,
    meta: {
      depth: 1,
    },
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
