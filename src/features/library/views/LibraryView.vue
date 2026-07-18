<template>
  <div>
    <page-header :has-back="false" hide-club page-name="My Library" />

    <div class="mx-auto max-w-3xl px-4 pb-12">
      <div
        v-if="showExplainer"
        class="mb-4 flex items-start gap-3 rounded-lg bg-lowBackground p-4"
      >
        <mdicon name="bookshelf" :size="24" class="shrink-0 text-highlight" />
        <div class="flex-1 text-sm text-gray-300">
          Your library shows every review you've written — across My Library and
          all your clubs — as one diary. Log solo watches here too; no club
          required.
        </div>
        <button
          class="text-sm font-medium text-highlight hover:underline"
          @click="dismiss"
        >
          Got it
        </button>
      </div>

      <loading-spinner v-if="isLoading" class="self-center" />

      <EmptyLibraryState v-else-if="isEmpty" />

      <template v-else>
        <TypeFilterPills class="mb-4" />

        <nav class="mb-4 flex justify-center gap-2 border-b border-white/10">
          <router-link
            :to="{ name: 'MyLibrary' }"
            class="px-4 py-2 text-sm font-medium text-gray-400"
            active-class="border-b-2 border-primary text-white"
            exact-active-class="border-b-2 border-primary text-white"
          >
            Diary
          </router-link>
          <router-link
            :to="{ name: 'MyLibraryWorks' }"
            class="px-4 py-2 text-sm font-medium text-gray-400"
            active-class="border-b-2 border-primary text-white"
          >
            Works
          </router-link>
        </nav>

        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements } from "../../../../lib/checks/checks";
import EmptyLibraryState from "../components/EmptyLibraryState.vue";
import TypeFilterPills from "../components/TypeFilterPills.vue";
import { useSoloExplainer } from "../composables/useSoloExplainer";

import { useMyReviews } from "@/service/useLibrary";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const { data, isLoading } = useMyReviews();

const isEmpty = computed(
  () => !isLoading.value && (data.value?.length ?? 0) === 0,
);

const { seen, dismiss } = useSoloExplainer();
// Existing users (who already have clubs) get the one-time explainer; brand-new
// users with no clubs see the empty-state cards instead.
const hasClubs = computed(() => hasElements(authStore.userClubs));
const showExplainer = computed(() => !seen.value && hasClubs.value);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--ease-standard);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
