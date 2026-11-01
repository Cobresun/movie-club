<template>
  <div class="flex items-center justify-between gap-2 p-3 sm:p-4">
    <div class="flex min-w-0 grow items-center gap-3">
      <router-link
        :to="logoDestination"
        class="shrink-0"
        :class="{ 'hidden md:block': showClubSwitcher }"
      >
        <h3 class="text-highlight text-2xl font-bold">MovieClub</h3>
      </router-link>
      <ClubSwitcher v-if="showClubSwitcher" />
    </div>
    <div v-if="authReady" class="flex shrink-0 items-center gap-2 sm:gap-4">
      <router-link
        :to="{ name: 'DailyGame' }"
        aria-label="Play Closer, the daily movie game"
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-highlight transition-colors duration-fast ease-standard hover:bg-white/10"
      >
        <mdicon name="lightbulb-on-outline" :size="22" />
        <span class="hidden text-sm font-semibold sm:inline">Daily game</span>
      </router-link>
      <AccountMenu v-if="isLoggedIn" />
      <v-btn v-else @click="login"> Login </v-btn>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import { hasValue } from "../../../lib/checks/checks.js";
import ClubSwitcher from "./ClubSwitcher.vue";
import AccountMenu from "@/features/profile/components/AccountMenu.vue";
import { useAuthStore } from "@/stores/auth";

const store = useAuthStore();
const route = useRoute();

const isLoggedIn = computed(() => store.isLoggedIn);
const authReady = computed(() => store.ready);

const currentSlug = computed(() => {
  const slug = route.params.clubSlug;
  return Array.isArray(slug) ? slug[0] : slug;
});

// A clubSlug in the route (e.g. on a /share/... page) only counts as club
// context when the user is actually a member of that club; visitors should
// be sent to the root instead of a club they can't access.
const hasClubContext = computed(() => {
  const slug = currentSlug.value;
  return hasValue(slug) && store.isClubMember(slug);
});

const showClubSwitcher = computed(() => isLoggedIn.value && hasClubContext.value);

const logoDestination = computed(() => {
  const slug = currentSlug.value;
  if (hasValue(slug) && store.isClubMember(slug)) {
    return { name: "ClubHome", params: { clubSlug: slug } };
  }
  return "/";
});

function login() {
  store.login();
}
</script>
