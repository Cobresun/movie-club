<template>
  <div class="px-6 py-10 md:px-24 md:py-16 lg:px-40">
    <!-- Hero -->
    <div
      class="flex flex-col space-y-10 md:flex-row-reverse md:items-center md:space-x-14 md:space-y-0"
    >
      <div class="flex-grow-0">
        <img :src="homeCinemaSvg" alt="Friends watching a movie together" />
      </div>

      <div class="flex flex-col space-y-6 text-left">
        <h1 class="text-3xl font-bold leading-tight md:text-5xl">
          Get your 🍿 ready for MovieClub: The Book Club for Movies
        </h1>
        <h2 class="text-1xl font-light md:text-2xl">
          Rate movies, compare favorites, and find patterns.
        </h2>
        <div>
          <v-btn class="px-4 py-1 text-lg" @click="getStarted">
            Get started — it's free
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Feature highlights -->
    <h2 class="mb-8 mt-16 text-center text-2xl font-bold md:text-3xl">
      Everything your club needs
    </h2>
    <div class="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <LandingFeatureCard
        v-for="feature in features"
        :key="feature.title"
        :image="feature.image"
        :title="feature.title"
        :description="feature.description"
      />
    </div>

    <!-- Closing CTA -->
    <div class="mt-16 flex flex-col items-center space-y-6 text-center">
      <p class="max-w-2xl text-xl font-light">
        Movies or books — start a club, invite your friends with a single link,
        and settle the scores together.
      </p>
      <v-btn class="px-4 py-1 text-lg" @click="getStarted">
        Start your club
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import LandingFeatureCard from "../components/LandingFeatureCard.vue";

import homeCinemaSvg from "@/assets/images/home_cinema.svg";
import awardsSvg from "@/assets/images/menu-images/awards.svg";
import reviewSvg from "@/assets/images/menu-images/review.svg";
import statisticsSvg from "@/assets/images/menu-images/statistics.svg";
import watchlistSvg from "@/assets/images/menu-images/watchlist.svg";
import { useAuthStore } from "@/stores/auth";

interface FeatureHighlight {
  image: string;
  title: string;
  description: string;
}

const features: FeatureHighlight[] = [
  {
    image: reviewSvg,
    title: "Reviews & Scores",
    description:
      "Score every movie as a club and see everyone's ratings side by side.",
  },
  {
    image: watchlistSvg,
    title: "Shared Lists",
    description:
      "Keep a shared watchlist and backlog so the next pick is never a debate.",
  },
  {
    image: statisticsSvg,
    title: "Statistics",
    description:
      "Charts reveal your club's patterns — top genres, toughest critics, and taste twins.",
  },
  {
    image: awardsSvg,
    title: "Awards",
    description:
      "Host your own annual awards with categories, nominations, and ranked voting.",
  },
];

const authStore = useAuthStore();

function getStarted() {
  authStore.login();
}
</script>
