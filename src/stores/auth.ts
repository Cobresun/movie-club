import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasValue, isDefined, isTrue } from "../../lib/checks/checks.js";
import { ClubPreview } from "../../lib/types/club";
import { resolveDefaultClubSlug } from "../common/composables/useLastClubSlug";
import { watchUntil } from "../common/composables/watchUntil";
import { authClient } from "@/lib/auth-client";

export const useAuthStore = defineStore("auth", () => {
  // Use Better Auth's reactive session hook
  const session = authClient.useSession();

  // Modal state for auth UI
  const showAuthModal = ref(false);

  // Derived state from session
  const user = computed(() => session.value.data?.user);
  const isLoggedIn = computed(() => isDefined(session.value.data?.session));
  const ready = computed(() => session.value.isPending === false);
  const isInitialLoading = computed(() => session.value.isPending === true);

  // Axios instance for authenticated requests
  // Better Auth handles cookies automatically, so we don't need to manually add auth headers
  const request = computed(() => axios.create());

  // Fetch user's clubs
  const {
    data: userClubs,
    isLoading: isLoadingUserClubs,
    isFetching: isFetchingUserClubs,
    refetch: refetchUserClubs,
  } = useQuery({
    queryKey: ["user", "clubs"],
    queryFn: async () => {
      const response = await request.value.get<ClubPreview[]>("/api/member/clubs");
      return response.data;
    },
    enabled: isLoggedIn,
  });

  const isClubMember = (clubSlug: string) => {
    return userClubs.value?.some((club) => club.slug === clubSlug) ?? false;
  };

  // Force a fresh fetch of the user's clubs and wait for it. Used as a safety
  // net by the route guard: waitForClubsReady awaits any in-flight refetch, but
  // if a create/join invalidation hasn't been picked up yet this guarantees a
  // fresh membership list before we declare a club inaccessible.
  const refreshClubs = async () => {
    await refetchUserClubs();
  };

  // Helper to wait for auth and clubs to be ready
  const waitForAuthReady = async () => {
    if (session.value.isRefetching || session.value.isPending) {
      await watchUntil(
        () => [session.value.isPending, session.value.isRefetching],
        ([isPending, isRefetching]) => !isPending && !isRefetching,
      );
    }
  };

  // Resolve once the clubs query is neither loading its first page nor
  // refetching. Waiting on isFetching (not just isLoading) means a refetch
  // triggered by creating or joining a club is awaited here, so route guards
  // see the fresh membership list rather than a stale cache.
  const waitForClubsReady = async () => {
    if (!isLoggedIn.value) return;
    if (isLoadingUserClubs.value || isFetchingUserClubs.value) {
      await watchUntil(
        () => [isLoadingUserClubs.value, isFetchingUserClubs.value],
        ([loading, fetching]) => !loading && !fetching,
      );
    }
  };

  // Auth actions
  const login = () => {
    showAuthModal.value = true;
  };

  const closeAuthModal = () => {
    showAuthModal.value = false;
  };

  const router = useRouter();
  const route = useRoute();

  const logout = async () => {
    // Sign out first, then navigate — if we navigate before signing out,
    // the router guard still sees isLoggedIn=true and redirects back to the club
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          // Session will automatically update via the reactive hook
        },
      },
    });

    // Wait for BetterAuth's reactive session to clear
    // (internally uses setTimeout + refetch after signOut)
    if (isLoggedIn.value) {
      await watchUntil(isLoggedIn, (loggedIn) => !loggedIn);
    }

    if (isTrue(route.meta.authRequired)) {
      router.push({ name: "Clubs" }).catch(console.error);
    }
  };

  const refreshSession = async () => {
    await session.value.refetch();
  };

  // Held as state, and not merely awaited, because App.vue's loading gate has
  // to stay up for the WHOLE hop. The clubs query resolving and the router
  // landing on the destination happen in different ticks: the gate's computed
  // and the watchUntil below both react to the same change, but Vue renders
  // before an awaited continuation runs, so between the two the app would
  // paint the page the user signed in from — the logged-out landing page.
  const isNavigatingAfterAuth = ref(false);

  /**
   * Post-login navigation, owned here so the flag above covers every path out
   * of the auth modal. `redirect` is the route the user was headed for before
   * they had to authenticate; without one they land on their default club.
   */
  const navigateAfterAuth = async (redirect?: string) => {
    isNavigatingAfterAuth.value = true;
    try {
      // Wait for BetterAuth's session to reflect the login —
      // onSuccess fires before the reactive session updates
      if (!isLoggedIn.value) {
        await watchUntil(isLoggedIn, (loggedIn) => loggedIn);
      }

      await waitForClubsReady();

      if (hasValue(redirect)) {
        // Already on the target (e.g. a club invite page): the view reacts to
        // the session change on its own, so pushing would only be a no-op
        // navigation failure.
        if (redirect !== route.fullPath) {
          await router.push(redirect);
        }
        return;
      }

      const slug = resolveDefaultClubSlug(userClubs.value);
      await router.push(
        isDefined(slug) ? { name: "ClubHome", params: { clubSlug: slug } } : { name: "NewClub" },
      );
    } catch (error) {
      console.error(error);
    } finally {
      isNavigatingAfterAuth.value = false;
    }
  };

  return {
    // Session data
    user,
    ready,
    isLoggedIn,
    isInitialLoading,
    session,

    // Auth UI
    showAuthModal,
    login,
    closeAuthModal,
    logout,
    refreshSession,

    // Axios (for backward compatibility)
    request,

    // User clubs
    userClubs,
    isClubMember,
    isLoadingUserClubs,
    refreshClubs,

    // Helper methods for router guards
    waitForAuthReady,
    waitForClubsReady,
    isNavigatingAfterAuth,
    navigateAfterAuth,
  };
});
