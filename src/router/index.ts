import {
  createRouter,
  createWebHistory,
  RouteRecordRaw,
  NavigationGuardNext,
  RouteLocationNormalized,
} from "vue-router";

import ClubRouterView from "./ClubRouterView.vue";
import { isDefined } from "../../lib/checks/checks.js";
import { ClubType } from "../../lib/types/generated/db";
import ClubHomeView from "../features/clubs/views/ClubHomeView.vue";
import HomeView from "../features/clubs/views/HomeView.vue";
import DiaryView from "../features/library/views/DiaryView.vue";
import LibraryView from "../features/library/views/LibraryView.vue";
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
 * Guard for movie-only features (Awards). Book clubs are redirected to their
 * club home, mirroring the nav which hides these entries for them.
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

/**
 * Guard for the user-scoped "My Library" tree. Unlike club routes there is no
 * membership to check — the scope is always the session user — so we only wait
 * for auth and require a login (sending guests to the marketing landing with a
 * redirect back). No clubs wait: the library renders without any club.
 */
const soloGuard = async (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext,
) => {
  const auth = useAuthStore();
  await auth.waitForAuthReady();
  if (!auth.isLoggedIn) {
    return next({ name: "Clubs", query: { redirect: to.fullPath } });
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
      // Everyone lands on their personal library once logged in; the
      // logged-out marketing HomeView is unchanged. The NewClub funnel moved
      // into the library's empty state rather than being the forced landing.
      if (!auth.isLoggedIn) return;
      return { name: "MyLibrary", replace: true };
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
    path: "/me",
    component: LibraryView,
    beforeEnter: soloGuard,
    meta: {
      depth: 1,
      authRequired: true,
    },
    children: [
      {
        path: "",
        name: "MyLibrary",
        component: DiaryView,
        meta: {
          depth: 1,
        },
      },
      {
        path: "works",
        name: "MyLibraryWorks",
        component: () => import("../features/library/views/WorksView.vue"),
        meta: {
          depth: 1,
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

const routerHistory = createWebHistory();

const router = createRouter({
  routes,
  history: routerHistory,
  scrollBehavior(to, from) {
    // Overlays like the bottom sheet / details drawer push a synthetic history
    // entry (see useBackButtonClose) that keeps the same URL, then pop it on
    // close. vue-router still runs scrollBehavior for that popstate; returning
    // { top: 0 } there yanks the underlying list to the top. Only reset scroll
    // when the path actually changes (i.e. navigating between routes).
    if (to.path === from.path) {
      return false;
    }
    return { top: 0 };
  },
});

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const historyPosition = () => {
  const position: unknown = routerHistory.state.position;
  return typeof position === "number" ? position : undefined;
};

// Safari plays its own native snapshot animation for the back/forward swipe
// gesture, so replaying ours doubles it. Traversals are detected by history
// position rather than a popstate listener: the browser has already moved to
// the target entry when guards run, whereas a push updates history only after
// navigation is confirmed — so a position change here means back/forward.
let lastPosition = historyPosition();

router.beforeEach((to, from) => {
  const isTraversal = historyPosition() !== lastPosition;
  let direction = "none";
  if (isDefined(from.name) && !(isSafari && isTraversal)) {
    if (to.meta.depth === from.meta.depth) {
      direction = "fade";
    } else {
      direction = to.meta.depth > from.meta.depth ? "push" : "pop";
    }
  }
  // Drives the html[data-route-transition="..."] CSS in tailwind.css. The
  // direction must live outside the <transition> props because a leaving page
  // keeps the props captured when it rendered (a dynamic :name can't change
  // the exit animation), while attribute selectors resolve live.
  document.documentElement.dataset.routeTransition = direction;
});

router.afterEach(() => {
  lastPosition = historyPosition();
});

export default router;
