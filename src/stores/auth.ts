import { useQuery } from "@tanstack/vue-query";
import axios from "axios";
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { isDefined, isTrue } from "../../lib/checks/checks.js";
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
  const { data: userClubs, isLoading: isLoadingUserClubs } = useQuery({
    queryKey: ["user", "clubs"],
    queryFn: async () => {
      const response =
        await request.value.get<ClubPreview[]>("/api/member/clubs");
      return response.data;
    },
    enabled: isLoggedIn,
  });

  const isClubMember = (clubSlug: string) => {
    return userClubs.value?.some((club) => club.slug === clubSlug) ?? false;
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

  const waitForClubsReady = async () => {
    if (isLoggedIn.value && isLoadingUserClubs.value) {
      await watchUntil(
        () => isLoadingUserClubs.value,
        (loading) => !loading,
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

  const navigateToDefaultClub = async () => {
    // Wait for BetterAuth's session to reflect the login —
    // onSuccess fires before the reactive session updates
    if (!isLoggedIn.value) {
      await watchUntil(isLoggedIn, (loggedIn) => loggedIn);
    }

    await waitForClubsReady();

    const slug = resolveDefaultClubSlug(userClubs.value);
    if (isDefined(slug)) {
      router
        .push({ name: "ClubHome", params: { clubSlug: slug } })
        .catch(console.error);
    } else {
      router.push({ name: "NewClub" }).catch(console.error);
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

    // Helper methods for router guards
    waitForAuthReady,
    waitForClubsReady,
    navigateToDefaultClub,
  };
});
