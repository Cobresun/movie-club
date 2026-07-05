<template>
  <div>
    <nav-bar />
    <div
      v-if="
        authStore.isInitialLoading ||
        (authStore.isLoggedIn && authStore.isLoadingUserClubs)
      "
      class="absolute w-full"
    >
      <div class="flex justify-center pt-20">
        <loading-spinner />
      </div>
    </div>
    <router-view v-else v-slot="{ Component }">
      <transition name="route">
        <component :is="Component" class="absolute w-full" />
      </transition>
    </router-view>

    <!-- Auth Modal -->
    <auth-modal
      v-if="authStore.showAuthModal"
      @close="authStore.closeAuthModal"
    />
  </div>
</template>

<script setup lang="ts">
import AuthModal from "@/common/components/AuthModal.vue";
import NavBar from "@/common/components/NavBar.vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
</script>
