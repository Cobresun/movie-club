<template>
  <div>
    <nav-bar />
    <router-view v-slot="{ Component, route }">
      <transition
        tag="div"
        class="w-full fixed"
        :enter-active-class="route.meta.transitionIn"
        :leave-active-class="route.meta.transitionOut"
      >
        <component
          :is="Component"
        />
      </transition>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { useStore } from 'vuex';
import NavBar from '@/components/NavBar.vue'

const store = useStore();
store.dispatch('init');
</script>