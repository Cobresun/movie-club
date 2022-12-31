<template>
  <div>
    <nav-bar />
    <router-view v-slot="{ Component, route }">
      <component
        :is="Component"
        v-if="isSafari"
        class="absolute w-full"
      />
      <transition
        v-else
        :enter-active-class="route.meta.transitionIn"
        :leave-active-class="route.meta.transitionOut"
      >
        <component
          :is="Component"
          class="absolute w-full"
        />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useAuthStore } from './stores/auth';

import NavBar from '@/common/components/NavBar.vue'

const authStore = useAuthStore();
authStore.init();

const isSafari = computed(() => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
})
</script>
