<template>
  <div class="home">
    <h1>Cobresun</h1>
    <btn @click="doStuff()">Sign In <mdicon name="arrow-right" /></btn>
    <router-link to="/reviews"><h3>Reviews</h3></router-link>
    <router-link to="/watchList"><h3>Watch List</h3></router-link>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
})
export default class Home extends Vue {
  doStuff(): void {
    console.log("stuff");
  }
}
</script>
