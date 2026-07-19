<template>
  <div class="mx-auto max-w-2xl p-6">
    <page-header
      :has-back="false"
      :hide-club="true"
      page-name="Add to Movie Club"
    />
    <loading-spinner
      v-if="!authStore.ready || clubsPending"
      class="self-center"
    />
    <AddMovieResolver
      v-else
      :key="targetKey"
      :target="target"
      :is-logged-in="authStore.isLoggedIn"
      :clubs="eligibleClubs"
      @added="onAdded"
      @login="authStore.login()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks";
import { parseAddLinkQuery } from "../addLink";
import AddMovieResolver from "../components/AddMovieResolver.vue";
import { AddedPayload } from "../types";

import { workTypeForClub } from "@/common/clubType";
import { setLastClubSlug } from "@/common/composables/useLastClubSlug";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const target = computed(() => parseAddLinkQuery(route.query));
const targetKey = computed(() =>
  [target.value.imdbId, target.value.title, target.value.year].join("|"),
);

// The resolver needs the club list to exist before it mounts, so its children
// can initialize their club selection without watching for late data.
const clubsPending = computed(
  () => authStore.isLoggedIn && !isDefined(authStore.userClubs),
);

const eligibleClubs = computed(() =>
  (authStore.userClubs ?? []).filter(
    (club) => workTypeForClub(club.type) === target.value.workType,
  ),
);

const onAdded = (payload: AddedPayload) => {
  setLastClubSlug(payload.clubSlug);
  toast.success(`Added "${payload.title}" to ${payload.clubName}`);
  router
    .replace({
      name: payload.isReviews ? "Reviews" : "Watchlists",
      params: { clubSlug: payload.clubSlug },
    })
    .catch(console.error);
};
</script>
