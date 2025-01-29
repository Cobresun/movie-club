<template>
  <div class="flex min-h-screen items-center justify-center">
    <div
      v-if="isLoggedIn"
      class="w-full max-w-md rounded-lg border p-8 text-center"
    >
      <h1 class="mb-4 text-2xl font-bold">Join Club</h1>

      <div v-if="isLoading || !club" class="py-4">
        <loading-spinner />
      </div>

      <template v-else>
        <p class="mb-6">
          You've been invited to join <strong>{{ club.clubName }}</strong>
        </p>

        <v-btn :loading="isJoining" @click="joinClub"> Join Club </v-btn>
      </template>
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

import { useClub, useJoinClub, useIsInClub } from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const clubId = route.params.clubId as string;

const { data: club, isLoading } = useClub(clubId);
const { mutate: joinClub, isLoading: isJoining } = useJoinClub(clubId);
const isInClub = useIsInClub(clubId);

const isLoggedIn = computed(() => authStore.isLoggedIn);

// Redirect to club home if user is already a member
watchEffect(() => {
  if (isInClub.value === true) {
    router
      .push({
        name: "ClubHome",
        params: { clubId },
      })
      .catch(console.error);
  }
});

const login = () => {
  router
    .push({
      name: "Login",
      query: { redirect: route.fullPath },
    })
    .catch(console.error);
};
</script>
