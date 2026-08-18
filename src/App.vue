<template>
  <div>
    <nav-bar />
    <div
      v-if="
        authStore.isInitialLoading ||
        (authStore.isLoggedIn && authStore.isLoadingUserClubs) ||
        authStore.isNavigatingAfterAuth
      "
      class="absolute w-full"
    >
      <!-- Boot placeholder. "/" resolves to a club home for anyone signed in, so
           this traces that page: title, member pills, then the nav cards. -->
      <div class="mx-auto max-w-5xl px-4 pt-6" role="status" aria-label="Loading">
        <SkeletonBlock class="mx-auto h-9 w-56 max-w-full rounded-lg" />
        <MemberPillsSkeleton class="mt-6" />
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <SkeletonBlock
            v-for="card in 4"
            :key="card"
            class="h-24 w-36 rounded-xl md:h-28 md:w-44"
            :style="{ '--skeleton-index': card - 1 }"
          />
        </div>
      </div>
    </div>
    <router-view v-else v-slot="{ Component }">
      <transition name="route">
        <component :is="Component" class="absolute w-full" />
      </transition>
    </router-view>

    <!-- Auth Modal -->
    <auth-modal v-if="authStore.showAuthModal" @close="authStore.closeAuthModal" />
  </div>
</template>

<script setup lang="ts">
import AuthModal from "@/common/components/AuthModal.vue";
import MemberPillsSkeleton from "@/common/components/MemberPillsSkeleton.vue";
import NavBar from "@/common/components/NavBar.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>
