<template>
  <div class="px-6 py-10 md:px-24 md:py-16 lg:px-40">
    <!-- Hero -->
    <div
      class="flex flex-col space-y-10 md:flex-row-reverse md:items-center md:space-y-0 md:space-x-14"
    >
      <div class="grow-0">
        <img :src="homeCinemaSvg" alt="Friends watching a movie together" />
      </div>

      <div class="flex flex-col space-y-6 text-left">
        <h1 class="text-3xl leading-tight font-bold md:text-5xl">
          Get your 🍿 ready for MovieClub: The Book Club for Movies
        </h1>
        <h2 class="text-1xl font-light md:text-2xl">
          Rate movies, compare favorites, and find patterns.
        </h2>
        <div>
          <v-btn class="px-4 py-1 text-lg" @click="getStarted"> Get started — it's free </v-btn>
        </div>
      </div>
    </div>

    <!-- Feature highlights -->
    <h2 class="mt-16 mb-8 text-center text-2xl font-bold md:text-3xl">
      Everything your club needs
    </h2>
    <div class="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
      <LandingFeatureCard
        v-for="feature in features"
        :key="feature.title"
        :image="feature.image"
        :title="feature.title"
        :description="feature.description"
      />
    </div>

    <!-- Daily games -->
    <div
      v-for="game in dailyGames"
      :key="game.clubType"
      class="from-secondary to-lowBackground mx-auto mt-16 flex max-w-4xl flex-col items-center gap-4 rounded-xl bg-linear-to-r p-6 text-center md:flex-row md:justify-between md:text-left"
    >
      <div>
        <h2 class="text-2xl font-bold">Play {{ game.name }}, the daily {{ game.noun }} game</h2>
        <p class="mt-1 font-light">{{ game.tagline }}</p>
      </div>
      <router-link
        :to="{ name: 'DailyGame', params: { clubType: game.clubType } }"
        class="bg-primary rounded-md px-4 py-2 text-lg font-bold tracking-wide whitespace-nowrap transition hover:brightness-110 active:brightness-105"
      >
        Play today's {{ game.noun }}
      </router-link>
    </div>

    <!-- Closing CTA -->
    <div class="mt-16 flex flex-col items-center space-y-6 text-center">
      <p class="max-w-2xl text-xl font-light">
        Movies or books — start a club, invite your friends with a single link, and settle the
        scores together.
      </p>
      <v-btn class="px-4 py-1 text-lg" @click="getStarted"> Start your club </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import LandingFeatureCard from "../components/LandingFeatureCard.vue";
import { isDefined } from "@/../lib/checks/checks";
import homeCinemaSvg from "@/assets/images/home_cinema.svg";
import reviewSvg from "@/assets/images/menu-images/review.svg";
import statisticsSvg from "@/assets/images/menu-images/statistics.svg";
import watchlistSvg from "@/assets/images/menu-images/watchlist.svg";
import { clubTypeConfig, dailyGameClubTypes } from "@/common/clubType";
import { useAuthStore } from "@/stores/auth";

const dailyGames = dailyGameClubTypes().flatMap((clubType) => {
  const { noun, dailyGame } = clubTypeConfig(clubType);
  return isDefined(dailyGame) ? [{ clubType, noun, ...dailyGame }] : [];
});

interface FeatureHighlight {
  image: string;
  title: string;
  description: string;
}

const features: FeatureHighlight[] = [
  {
    image: reviewSvg,
    title: "Reviews & Scores",
    description: "Score every movie as a club and see everyone's ratings side by side.",
  },
  {
    image: watchlistSvg,
    title: "Shared Lists",
    description: "Keep a shared watchlist and backlog so the next pick is never a debate.",
  },
  {
    image: statisticsSvg,
    title: "Statistics",
    description:
      "Charts reveal your club's patterns — top genres, toughest critics, and taste twins.",
  },
];

const authStore = useAuthStore();

function getStarted() {
  authStore.login();
}
</script>
