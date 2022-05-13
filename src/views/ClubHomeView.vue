<template>
  <div>
    <h1 class="font-bold text-3xl m-4">Cobresun</h1>
    <div class="flex justify-center pb-6 flex-col md:flex-row">
      <div class="p-3">
        <router-link to="/reviews"><menu-card image="review.svg">Reviews</menu-card></router-link>
      </div>
      <div class="p-3">
        <router-link to="/reviews-gallery"><menu-card image="review.svg">Reviews Gallery</menu-card></router-link>
      </div>
      <div class="p-3">
        <router-link to="/watchList"><menu-card image="watchlist.svg">Watch List</menu-card></router-link>
      </div>
      <div class="p-3">
        <router-link to="/statistics"><menu-card image="statistics.svg">Statistics</menu-card></router-link>
      </div>
    </div>
    <!-- <btn>Club Settings <mdicon name="cog-outline" /></btn> -->
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({})
export default class Home extends Vue {
}
</script>
