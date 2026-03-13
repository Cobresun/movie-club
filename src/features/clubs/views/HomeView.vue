<template>
  <div
    class="flex flex-col space-y-10 px-10 py-10 md:flex-row-reverse md:space-x-14 md:px-48 md:py-48"
  >
    <div class="flex-grow-0">
      <img :src="homeCinemaSvg" />
    </div>

    <div class="flex flex-col space-y-8 text-left">
      <h1 class="text-3xl font-bold leading-tight md:text-5xl">
        Get your 🍿 ready for MovieClub: The Book Club for Movies
      </h1>
      <h2 class="text-1xl font-light md:text-2xl">
        Rate movies, compare favorites, and find patterns.
      </h2>
    </div>
  </div>
</template>

<script setup lang="ts">
import homeCinemaSvg from "@/assets/images/home_cinema.svg";
</script>
