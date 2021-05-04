<template>
  <div id="app">
    <nav-bar/>
    <router-view/>
  </div>
</template>
<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import NavBar from '@/components/NavBar.vue';

@Options({
  components: {
    NavBar,
  },
})
export default class App extends Vue {}
</script>
<style>
@import './assets/styles/variables.css';
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;700&display=swap');
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #ffffff;
}

.nav {
  padding: 30px;
}
</style>
