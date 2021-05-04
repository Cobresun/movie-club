<template>
  <div class="home">
    <h1>Cobresun</h1>
    <btn @click="doStuff()">Sign In <mdicon name="arrow-right" /></btn>
    <h3><router-link to="/reviews">Reviews</router-link></h3>
    <h3><router-link to="/watchList">Watch List</router-link></h3>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';

@Component({})
export default class Home extends Vue {
  doStuff(): void {
    console.log("stuff");
    this.$router.push({path: "reviews"})
  }
}
</script>
