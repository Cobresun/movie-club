<template>
  <div class="home">
    <h1>Cobresun</h1>
    <div class="menu">
      <div class="menu-option">
        <router-link to="/reviews"><menu-card image="review.svg">Reviews</menu-card></router-link>
      </div>
      <div class="menu-option">
        <router-link to="/watchList"><menu-card image="watchlist.svg">Watch List</menu-card></router-link>
      </div>
      <div class="menu-option">
        <router-link to="/"><menu-card image="statistics.svg">Statistics</menu-card></router-link>
      </div>
    </div>
    <btn>Club Settings <mdicon name="cog-outline" /></btn>
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
<style scoped>
.menu {
  display: flex;
  justify-content: center;
  padding-bottom: 24px;
}

@media (max-width: 700px) {
  .menu {
    flex-direction: column;
  }
}

.menu-option {
  padding: 12px;
}
</style>
