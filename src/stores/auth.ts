import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { create } from "axios";
import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasValue, isDefined, isString, isTrue } from "../../lib/checks/checks.js";
import { type ClubPreview } from "../../lib/types/club";
import { resolveDefaultClubSlug } from "../common/composables/useLastClubSlug";
import { getRememberedUser, setRememberedUser } from "../common/composables/useSessionHint";
import { watchUntil } from "../common/composables/watchUntil";
import { authClient } from "@/lib/auth-client";

export const useAuthStore = defineStore("auth", () => {
  // Use Better Auth's reactive session hook
  const session = authClient.useSession();

  // Modal state for auth UI
  const showAuthModal = ref(false);
  // Which tab the modal opens on. Read once when it mounts; the tabs inside it
  // switch freely after that.
  const authModalOpensOnSignUp = ref(false);

  // Read once, before the session check comes back: it describes the PREVIOUS
  // session, so nothing that happens now can change what it should have said.
  // It is the app's only clue, during that check, about who is here.
  const rememberedUser = getRememberedUser();

  // Only the first check of a page load is covered by that clue. BetterAuth
  // goes back to pending whenever it rechecks with no session in hand (after
  // a sign-out, say), and by then the remembered member is the one who left.
  const firstCheckSettled = ref(false);

  /**
   * The session check of a cold load is still out, and the last session this
   * browser resolved was signed in. Rather than hold the screen for a round
   * trip that nearly always confirms it, the app carries on as that member:
   * guards let them through on cached membership and pages paint from the
   * persisted cache, with the requests they make revalidating behind it. The
   * server remains the authority on every one of those requests. If the check
   * comes back signed out, `leaveAssumedSession` undoes it.
   */
  const isAssumedSignedIn = computed(
    () => !firstCheckSettled.value && session.value.isPending && isDefined(rememberedUser),
  );

  // What the session check itself says, with no assumption in it.
  const isSessionSettled = computed(() => !session.value.isPending);
  const hasSession = computed(() => isDefined(session.value.data?.session));

  // Derived state from session
  const user = computed(
    () => session.value.data?.user ?? (isAssumedSignedIn.value ? rememberedUser : undefined),
  );
  const isLoggedIn = computed(() => hasSession.value || isAssumedSignedIn.value);
  const ready = computed(() => isSessionSettled.value || isAssumedSignedIn.value);
  const isInitialLoading = computed(() => !ready.value);

  const queryClient = useQueryClient();
  const router = useRouter();
  const route = useRoute();

  // The URL this page load began on. A visit to the site root that turns out
  // to be signed out belongs on the landing page, not on a members-only notice
  // for the club its cache sent it to.
  const arrivedAtRoot = window.location.pathname === "/";

  /**
   * The assumed session turned out not to exist. Sends the visitor where the
   * route guards would have, had they waited for the check, and drops what
   * the cache held for the member who is no longer signed in.
   */
  const leaveAssumedSession = async () => {
    // A navigation the assumption let through may still be on its way in.
    await router.isReady();
    if (isTrue(route.meta.authRequired)) {
      const isClubPage = isString(route.params.clubSlug);
      await router.replace(
        isClubPage && !arrivedAtRoot
          ? { name: "ClubNotFound", query: { redirect: route.fullPath } }
          : { name: "Clubs" },
      );
    }
    queryClient.removeQueries({ type: "inactive" });
  };

  // Keep the record honest for the next cold load.
  watch(
    [isSessionSettled, hasSession],
    ([settled, signedIn]) => {
      if (!settled) return;
      const wasAssumed = !firstCheckSettled.value && isDefined(rememberedUser);
      firstCheckSettled.value = true;

      if (signedIn) {
        setRememberedUser(session.value.data?.user);
        return;
      }

      // A check that failed says nothing about the session: the member is
      // still remembered, so their next load starts just as quickly.
      const checkFailed = isDefined(session.value.error);
      if (!checkFailed) setRememberedUser(undefined);

      // Nobody's clubs belong in the cache once signed out — including a
      // fetch made on the assumption above, which would otherwise leave the
      // query in an error state that a later sign-in's waitForClubsReady
      // reads as settled.
      queryClient.resetQueries({ queryKey: ["user", "clubs"] }).catch(console.error);
      if (wasAssumed) leaveAssumedSession().catch(console.error);
    },
    { immediate: true },
  );

  // Axios instance for authenticated requests
  // Better Auth handles cookies automatically, so we don't need to manually add auth headers
  const request = computed(() => create());

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
    retry: (failureCount) => isLoggedIn.value && failureCount < 3,
  });

  const isClubMember = (clubSlug: string) =>
    userClubs.value?.some((club) => club.slug === clubSlug) ?? false;

  // Force a fresh fetch of the user's clubs and wait for it. Used as a safety
  // net by the route guard: waitForClubsReady awaits any in-flight refetch, but
  // if a create/join invalidation hasn't been picked up yet this guarantees a
  // fresh membership list before we declare a club inaccessible.
  const refreshClubs = async () => {
    await refetchUserClubs();
  };

  // Resolve once the session can answer "is anyone signed in?". BetterAuth
  // refetches the session on every window focus; a signed-in session already
  // answers that, so only a first check, or a refetch that could still sign
  // someone in, holds navigation up. A first check that is expected to confirm
  // a remembered member does not hold it up either.
  const waitForAuthReady = async () => {
    const mustWait = () => !ready.value || (session.value.isRefetching && !isLoggedIn.value);
    if (mustWait()) {
      await watchUntil(
        () => [ready.value, session.value.isRefetching, isLoggedIn.value],
        () => !mustWait(),
      );
    }
  };

  // Resolve once the persisted cache has been read back. It is read
  // asynchronously, so a guard that runs as the app boots would otherwise
  // ask the cache about membership before the cache has anything in it.
  const waitForCacheRestored = async () => {
    if (queryClient.isRestoring.value) {
      await watchUntil(queryClient.isRestoring, (restoring) => !restoring);
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
    authModalOpensOnSignUp.value = false;
    showAuthModal.value = true;
  };

  const signUp = () => {
    authModalOpensOnSignUp.value = true;
    showAuthModal.value = true;
  };

  const closeAuthModal = () => {
    showAuthModal.value = false;
  };

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
      await router.push({ name: "Clubs" }).catch(console.error);
    }

    // What the member was looking at stays on this device otherwise, for
    // whoever uses the browser next. A public page they signed out on keeps
    // the queries it is still showing.
    queryClient.removeQueries({ type: "inactive" });
  };

  // Profile edits write the user row directly, so the signed session_data
  // cookie keeps describing the old name and avatar until it expires.
  // `disableCookieCache` makes get-session read the database — and rewrite the
  // cookie — so the refreshed session is the one that was just saved.
  const refreshSession = async () => {
    await session.value.refetch({ query: { disableCookieCache: true } });
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

  /**
   * The app can't hand the screen over to the router yet: the session check is
   * still out, a signed-in user's clubs are loading, or someone who just
   * signed in is being moved to their destination.
   *
   * Note this is what makes the session check block routes that have no guard
   * of their own (JoinClub, NewClub). They branch on isLoggedIn at render
   * time, so letting them paint mid-check shows a signed-in user the
   * logged-out half of the page.
   */
  const isAppLoading = computed(
    () =>
      isInitialLoading.value ||
      (isLoggedIn.value && isLoadingUserClubs.value) ||
      isNavigatingAfterAuth.value,
  );

  /**
   * ...and the stretch of that where a club is what's coming, so App.vue can
   * put up a placeholder shaped like the section it lands on.
   *
   * A cold load whose last session was signed out is deliberately excluded: it
   * may well be a visitor on their way to the landing page, and painting a
   * club at them is a flash of a screen they never asked for. They get a
   * held blank frame instead, for the same few hundred milliseconds. One whose
   * last session was signed in counts as logged in for this purpose already.
   */
  const isLoadingClubHome = computed(() => isAppLoading.value && isLoggedIn.value);

  return {
    // Session data
    user,
    ready,
    isLoggedIn,
    isInitialLoading,
    isAppLoading,
    isLoadingClubHome,
    session,

    // Auth UI
    showAuthModal,
    authModalOpensOnSignUp,
    login,
    signUp,
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
    waitForCacheRestored,
    waitForClubsReady,
    isNavigatingAfterAuth,
    navigateAfterAuth,
  };
});
