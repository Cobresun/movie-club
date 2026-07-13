<template>
  <div class="flex min-h-screen items-center justify-center">
    <div
      v-if="isLoggedIn"
      class="w-full max-w-md rounded-lg border p-8 text-center"
    >
      <h1 class="mb-4 text-2xl font-bold">Join Club</h1>

      <div v-if="isLoading" class="py-4">
        <loading-spinner />
      </div>

      <template v-else-if="clubDetails">
        <p class="mb-6">
          You've been invited to join
          <strong>{{ clubDetails.clubName }}</strong>
        </p>

        <v-btn @click="handleJoinClub"> Join Club </v-btn>
      </template>

      <div v-else-if="clubDetailsError" class="text-red-500">
        The invite token is invalid or expired.
      </div>
    </div>

    <div v-else class="text-center">
      <p class="mb-4">Please log in to join this club</p>
      <v-btn @click="login">Log In</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import { hasValue } from "../../../../lib/checks/checks.js";

import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
import { useJoinClub, useClubDetails, useIsInClub } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const inviteToken = route.params.inviteToken as string;

const isLoggedIn = computed(() => authStore.isLoggedIn);

const { mutate: joinClub, isLoading: isJoining } = useJoinClub(inviteToken);
const {
  data: clubDetails,
  isLoading: isClubDetailsLoading,
  error: clubDetailsError,
} = useClubDetails(inviteToken);
const isLoading = computed(() => isClubDetailsLoading.value || isJoining.value);

const clubSlug = computed(() => clubDetails.value?.slug ?? "");
const isInClub = useIsInClub(clubSlug);

const handleJoinClub = () => {
  joinClub();
};

// Redirects to the club once the user is a member — either immediately for
// users who were already members, or after the join mutation refreshes the
// membership list. `replace` keeps the invite page out of history so the back
// button doesn't bounce the user through the redirect again.
watchEffect(() => {
  if (isInClub.value === true && hasValue(clubSlug.value)) {
    setLastClubSlug(clubSlug.value);
    router
      .replace({
        name: "ClubHome",
        params: { clubSlug: clubSlug.value },
      })
      .catch(console.error);
  }
});

const login = () => {
  authStore.login();
};
</script>
