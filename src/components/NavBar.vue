<template>
  <div class="bar">
    <router-link to="/"><h3 class="title">MovieClub</h3></router-link>
    <btn
      @click="login"

    >Login</btn>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class NavBar extends Vue {
  login(): void {
    this.$store.dispatch('login');
  }
}
</script>

<style scoped>
.title {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 25px;
  color: var(--highlight-color);
  text-align: left;
  margin-left:20px;
}

.bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
