<template>
  <div>
    <router-link to="/"><h3 class="title">MovieClub</h3></router-link>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class NavBar extends Vue {}
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
</style>
