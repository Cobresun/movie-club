<template>
  <div>
    <nav-bar/>
    <router-view/>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue'
import { useStore } from 'vuex';
import NavBar from '@/components/NavBar.vue'

export default defineComponent({
  components: { NavBar },
  setup() {
    const store = useStore();
    onMounted(() => {
      store.dispatch('init');
    });
  },
})
</script>