<template>
  <div>
    <page-header :has-back="false" page-name="" />
    <div class="flex flex-col justify-center pb-6 md:flex-row">
      <div class="p-3">
        <router-link :to="{ name: 'Reviews' }">
          <menu-card :image="reviewSvg"> Reviews </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'WatchList' }">
          <menu-card :image="watchlistSvg"> Watch List </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'Statistics' }">
          <menu-card :image="statisticsSvg"> Statistics </menu-card>
        </router-link>
      </div>
      <div class="p-3">
        <router-link :to="{ name: 'Awards' }">
          <menu-card :image="awardsSvg"> Awards </menu-card>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import awardsSvg from "@/assets/images/menu-images/awards.svg";
import reviewSvg from "@/assets/images/menu-images/review.svg";
import statisticsSvg from "@/assets/images/menu-images/statistics.svg";
import watchlistSvg from "@/assets/images/menu-images/watchlist.svg";
</script>
