<template>
  <div class="home">
    <h1>Cobresun</h1>

    <router-link to="/reviews"><h3>Reviews</h3></router-link>
    <router-link to="/watchList"><h3>Watch List</h3></router-link>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
})

export default class Home extends Vue {}
</script>
