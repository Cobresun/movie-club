<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <section
      aria-labelledby="landing-taste-heading"
      class="bg-background flex flex-col gap-4 rounded-2xl border border-white/10 p-5 text-left"
    >
      <h3 id="landing-taste-heading" class="text-sm font-semibold text-gray-300">
        Taste similarity
      </h3>
      <div class="flex items-center justify-center gap-4">
        <div class="flex flex-col items-center gap-1">
          <v-avatar name="Maya" :size="48" />
          <span class="text-xs text-gray-300">Maya</span>
        </div>
        <div class="flex flex-col items-center">
          <span class="text-3xl font-extrabold text-emerald-300">91%</span>
          <span class="text-xs text-gray-400">similar</span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <v-avatar name="Priya" :size="48" />
          <span class="text-xs text-gray-300">Priya</span>
        </div>
      </div>
      <p class="rounded bg-emerald-900/20 px-3 py-2 text-sm text-gray-300">
        Within <span class="font-semibold text-emerald-300">0.6</span> points across 34 shared
        reviews
      </p>
      <div>
        <p class="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
          Top agreements
        </p>
        <ul class="flex flex-col gap-1 text-sm">
          <li class="flex justify-between text-gray-300">
            <span>Past Lives</span><span class="font-semibold text-white">9 · 9.5</span>
          </li>
          <li class="flex justify-between text-gray-300">
            <span>Perfect Days</span><span class="font-semibold text-white">8 · 8</span>
          </li>
        </ul>
      </div>
    </section>

    <div class="flex flex-col gap-4">
      <section
        aria-labelledby="landing-genres-heading"
        class="bg-background flex flex-col gap-3 rounded-2xl border border-white/10 p-5 text-left"
      >
        <h3 id="landing-genres-heading" class="text-sm font-semibold text-gray-300">Top genres</h3>
        <ul class="flex flex-col gap-2 text-xs">
          <li
            v-for="genre in GENRES"
            :key="genre.name"
            class="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2"
          >
            <span class="text-gray-300">{{ genre.name }}</span>
            <span class="bg-lowBackground h-2.5 overflow-hidden rounded-full" aria-hidden="true">
              <span class="bg-highlight block h-full rounded-full" :class="genre.width" />
            </span>
            <span class="text-right font-semibold">{{ genre.share }}</span>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="landing-critic-heading"
        class="bg-background flex items-center gap-4 rounded-2xl border border-white/10 p-5 text-left"
      >
        <v-avatar name="Sam" :size="44" />
        <div class="min-w-0 grow">
          <h3
            id="landing-critic-heading"
            class="text-xs font-semibold tracking-wide text-gray-400 uppercase"
          >
            Toughest critic
          </h3>
          <p class="font-semibold">Sam averages 6.4</p>
          <p class="text-xs text-gray-400">Club average is 7.6</p>
        </div>
        <span class="text-lg font-bold text-orange-300">−1.2</span>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
const GENRES = [
  { name: "Drama", share: "38%", width: "w-full" },
  { name: "Sci-fi", share: "21%", width: "w-3/5" },
  { name: "Comedy", share: "17%", width: "w-1/2" },
  { name: "Thriller", share: "12%", width: "w-1/3" },
];
</script>
