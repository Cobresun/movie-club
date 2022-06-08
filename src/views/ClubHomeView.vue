<template>
  <div>
    <h1 class="font-bold text-3xl m-4">
      Cobresun
    </h1>
    <div class="flex justify-center pb-6 flex-col md:flex-row">
      <div class="p-3">
        <router-link :to="{ name: 'Reviews' }">
          <menu-card :image="reviewSvg">
            Reviews
          </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'ReviewsGallery' }">
          <menu-card :image="reviewSvg">
            Reviews Gallery
          </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'WatchList' }">
          <menu-card :image="watchlistSvg">
            Watch List
          </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'Statistics' }">
          <menu-card :image="statisticsSvg">
            Statistics
          </menu-card>
        </router-link>
      </div>
    </div>
    <!--<v-btn>Club Settings <mdicon name="cog-outline" /></v-btn> -->
  </div>
</template>

<script setup lang="ts">
import reviewSvg from "@/assets/menu-images/review.svg";
import watchlistSvg from "@/assets/menu-images/watchlist.svg";
import statisticsSvg from "@/assets/menu-images/statistics.svg";
</script>
