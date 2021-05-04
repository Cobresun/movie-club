<template>
  <div>
    <h3 class="title"><router-link to="/">MovieClub</router-link></h3>
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
  color: var(--primary-color);
  text-align: left;
  margin-left:20px;
}
</style>
