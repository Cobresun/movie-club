import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import ClubRouterView from "./ClubRouterView.vue";
import { hasElements, isDefined } from "../../lib/checks/checks.js";
import { ClubType } from "../../lib/types/generated/db";
import { resolveDefaultClubSlug } from "../common/composables/useLastClubSlug";
import ClubHomeView from "../features/clubs/views/ClubHomeView.vue";
import HomeView from "../features/clubs/views/HomeView.vue";
import ReviewView from "../features/reviews/views/ReviewView.vue";

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

  // waitForClubsReady waits out any in-flight refetch (e.g. the one triggered
  // by creating or joining a club), so the membership check below usually sees
  // the fresh list rather than a stale cache.
  await auth.waitForClubsReady();

  const clubSlug = to.params.clubSlug as string;
  if (auth.isClubMember(clubSlug)) {
    return next();
  }

  // Safety net: if the create/join invalidation hadn't started its refetch when
  // waitForClubsReady checked, the cache may still be stale. Force one refresh
  // and re-check before declaring the club inaccessible.
  await auth.refreshClubs();
  if (auth.isClubMember(clubSlug)) {
    return next();
  }

  // User is genuinely not a member of this club
  return next({ name: "ClubNotFound" });
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

/**
 * Guard for movie-only features (Statistics, Awards). Book clubs are redirected
 * to their club home, mirroring the nav which hides these entries for them.
 */
const movieClubOnly = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const auth = useAuthStore();
  await auth.waitForAuthReady();
  await auth.waitForClubsReady();

  const clubSlug = to.params.clubSlug as string;
  const club = auth.userClubs?.find((c) => c.slug === clubSlug);
  if (club && club.type !== ClubType.movie) {
    return next({ name: "ClubHome", params: { clubSlug } });
  }
  return next();
};

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    name: "Clubs",
    component: HomeView,
    beforeEnter: async () => {
      const auth = useAuthStore();
      await auth.waitForAuthReady();
      if (!auth.isLoggedIn) return;

      await auth.waitForClubsReady();
      const clubs = auth.userClubs;

      if (!hasElements(clubs)) {
        return { name: "NewClub", replace: true };
      }

      const slug = resolveDefaultClubSlug(clubs);
      if (!isDefined(slug)) {
        return { name: "NewClub", replace: true };
      }

      return {
        name: "ClubHome",
        params: { clubSlug: slug },
        replace: true,
      };
    },
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
    path: "/share/club/:clubSlug/list/:listId",
    name: "SharedList",
    component: () => import("../features/watch-list/views/SharedListView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/share/club/:clubSlug/statistics",
    name: "SharedStatistics",
    component: () =>
      import("../features/statistics/views/SharedStatisticsView.vue"),
    meta: {
      depth: 1,
      noAuth: true,
    },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("../features/profile/views/ProfileView.vue"),
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
    component: () => import("../features/clubs/views/NewClubView.vue"),
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
        path: "lists",
        name: "Watchlists",
        component: () =>
          import("../features/watch-list/views/WatchListView.vue"),
        props: true,
        meta: {
          depth: 2,
        },
      },
      {
        path: "watch-list",
        redirect: { name: "Watchlists" },
      },
      {
        path: "statistics",
        name: "Statistics",
        component: () =>
          import("../features/statistics/views/StatisticsView.vue"),
        beforeEnter: movieClubOnly,
        props: true,
        meta: {
          depth: 2,
        },
      },
      {
        path: "awards",
        name: "Awards",
        component: () => import("../features/awards/views/AwardsView.vue"),
        beforeEnter: movieClubOnly,
        props: true,
        meta: {
          depth: 2,
        },
        children: [
          {
            path: ":year",
            name: "AwardsYear",
            component: () => import("../features/awards/views/YearView.vue"),
            props: true,
            children: [
              {
                path: "categories",
                name: "AwardsCategories",
                props: true,
                component: () =>
                  import("../features/awards/views/CategoriesView.vue"),
              },
              {
                path: "nominations",
                name: "AwardsNominations",
                props: true,
                component: () =>
                  import("../features/awards/views/NominationsView.vue"),
              },
              {
                path: "rankings",
                name: "AwardsRankings",
                props: true,
                component: () =>
                  import("../features/awards/views/RankingsView.vue"),
              },
              {
                path: "results",
                name: "AwardsResults",
                props: true,
                component: () =>
                  import("../features/awards/views/ResultView.vue"),
              },
            ],
          },
        ],
      },
      {
        path: "settings",
        name: "ClubSettings",
        component: () =>
          import("../features/settings/views/ClubSettingsView.vue"),
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
    component: () => import("../features/settings/views/JoinClubView.vue"),
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
  const fadeIn = "animate__animated animate__faster animate__fadeIn";
  if (!isDefined(from.name)) {
    to.meta.transitionIn = fadeIn;
    return;
  }
  const slideInRight =
    "animate__animated animate__faster animate__slideInRight";
  const slideInLeft = "animate__animated animate__faster animate__slideInLeft";
  const slideOutRight =
    "animate__animated animate__faster animate__slideOutRight";
  const slideOutLeft =
    "animate__animated animate__faster animate__slideOutLeft";
  if (to.meta.depth === from.meta.depth) {
    to.meta.transitionIn = fadeIn;
    to.meta.transitionOut = undefined;
  } else {
    to.meta.transitionIn =
      to.meta.depth > from.meta.depth ? slideInRight : slideInLeft;
    to.meta.transitionOut =
      to.meta.depth > from.meta.depth ? slideOutLeft : slideOutRight;
  }
});

export default router;
