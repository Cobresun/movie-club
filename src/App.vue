<template>
  <div>
    <nav-bar/>
    <router-view/>
  </div>
</template>

<script setup lang="ts">
import { useStore } from 'vuex';
import NavBar from '@/components/NavBar.vue'

const store = useStore();
store.dispatch('init');
</script>