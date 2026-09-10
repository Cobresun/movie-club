<template>
  <div>
    <nav-bar />
    <div v-if="authStore.isAppLoading" class="absolute w-full">
      <!-- Only painted once a club is known to be what's coming. A club URL
           lands on a section, Reviews by default, so the placeholder is shaped
           like ReviewView: its title, then its own loading state. While the
           session check is still out on a browser whose last session was
           signed out, this stays empty rather than flashing a club at a
           visitor bound for the landing page. -->
      <div v-if="authStore.isLoadingClubHome" class="p-2">
        <SkeletonBlock class="mx-auto my-2 h-8 w-32 rounded-lg sm:my-4 sm:h-9" />
        <ReviewsSkeleton />
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
import NavBar from "@/common/components/NavBar.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import ReviewsSkeleton from "@/features/reviews/components/ReviewsSkeleton.vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>
