import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import ClubRouterView from "./ClubRouterView.vue";
import { isDefined } from "../../lib/checks/checks.js";
import ClubHomeView from "../features/clubs/views/ClubHomeView.vue";
import ClubsView from "../features/clubs/views/ClubsView.vue";
import NewClubView from "../features/clubs/views/NewClubView.vue";
import ReviewView from "../features/reviews/views/ReviewView.vue";
import ClubSettingsView from "../features/settings/views/ClubSettingsView.vue";
import JoinClubView from "../features/settings/views/JoinClubView.vue";
import StatisticsView from "../features/statistics/views/StatisticsView.vue";
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
  await auth.waitForAuthReady();
  if (!auth.isLoggedIn) {
    return next({
      name: "ClubNotFound",
      query: { redirect: to.fullPath },
    });
  }

  await auth.waitForClubsReady();

  const clubSlug = to.params.clubSlug as string;
  if (auth.isClubMember(clubSlug)) {
    return next();
  } else {
    // User is not a member of this club
    return next({ name: "ClubNotFound" });
  }
};

/**
 * Combined guard that first redirects numeric IDs to slugs,
 * then checks club access
 */
const clubGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const auth = useAuthStore();
  const clubSlug = to.params.clubSlug as string;

  // First, check if we need to redirect numeric ID to slug
  if (clubSlug && /^\d+$/.test(clubSlug)) {
    // Wait for clubs to be ready
    await auth.waitForAuthReady();
    await auth.waitForClubsReady();

    // Look up the club by numeric ID in user's clubs
    const club = auth.userClubs?.find((c) => c.clubId === clubSlug);

    if (club) {
      // Replace the numeric ID with the slug in the full path
      const newPath = to.path.replace(
        `/club/${clubSlug}`,
        `/club/${club.slug}`,
      );

      // Redirect to slug-based URL, replacing history entry
      return next({
        path: newPath,
        query: to.query, // Preserve query params
        hash: to.hash, // Preserve hash
        replace: true, // Don't add to history
      });
    }
    // If club not found, continue to access check which will show ClubNotFound
  }

  // No redirect needed, proceed to access check
  return checkClubAccess(to, from, next);
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
    path: "/verify-email",
    name: "VerifyEmail",
    component: () => import("../features/auth/views/VerifyEmailView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("../features/auth/views/ForgotPasswordView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/reset-password",
    name: "ResetPassword",
    component: () => import("../features/auth/views/ResetPasswordView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/share/club/:clubSlug/review/:workId",
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
    beforeEnter: async (to, from, next) => {
      const auth = useAuthStore();

      await auth.waitForAuthReady();
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
    path: "/newClub",
    name: "NewClub",
    component: NewClubView,
    meta: {
      depth: 1,
      authRequired: true,
    },
  },
  {
    path: "/club/:clubSlug",
    component: ClubRouterView,
    beforeEnter: clubGuard,
    props: true,
    meta: {
      depth: 1,
      authRequired: true,
    },
    children: [
      {
        path: "",
        name: "ClubHome",
        component: ClubHomeView,
        props: true,
        meta: {
          depth: 1,
        },
      },
      {
        path: "reviews",
        name: "Reviews",
        component: ReviewView,
        props: true,
        meta: {
          depth: 2,
        },
      },
      {
        path: "watch-list",
        name: "WatchList",
        component: WatchListView,
        props: true,
        meta: {
          depth: 2,
        },
      },
      {
        path: "statistics",
        name: "Statistics",
        component: StatisticsView,
        props: true,
        meta: {
          depth: 2,
        },
      },
      {
        path: "awards",
        name: "Awards",
        component: AwardsView,
        props: true,
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
        path: "settings",
        name: "ClubSettings",
        component: ClubSettingsView,
        props: true,
        meta: {
          depth: 2,
          authRequired: true,
        },
      },
    ],
  },
  {
    path: "/join-club/:inviteToken",
    name: "JoinClub",
    component: JoinClubView,
    meta: {
      depth: 1,
    },
  },
  {
    path: "/club-not-found",
    name: "ClubNotFound",
    component: () => import("../common/views/ClubNotFoundView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../common/views/NotFoundView.vue"),
    meta: {
      depth: 0,
      noAuth: true,
    },
  },
];

const router = createRouter({
  routes,
  history: createWebHistory(),
  scrollBehavior() {
    // Always scroll to top when navigating between routes
    return { top: 0 };
  },
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
