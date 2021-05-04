<template>
  <div>
    <h3 class="title">MovieClub</h3>
  </div>
</template>
<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
})
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