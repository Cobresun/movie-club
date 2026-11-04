<template>
  <ul
    class="flex flex-wrap items-center justify-center gap-5 py-4"
    aria-label="Sample Wrapped cards"
  >
    <li
      class="bg-secondary flex h-80 w-48 -rotate-3 flex-col justify-between rounded-3xl p-5 text-left shadow-2xl shadow-black/60"
    >
      <WrappedProgress :seen="1" />
      <div>
        <p class="text-sm text-gray-200">In 2026 your club watched</p>
        <p class="text-6xl font-extrabold">48</p>
        <p class="text-lg font-semibold">movies</p>
      </div>
      <p class="text-xs text-gray-200">That’s 91 hours together.</p>
    </li>
    <li
      class="flex h-80 w-48 flex-col justify-between rounded-3xl bg-rose-950 p-5 text-left shadow-2xl shadow-black/60"
    >
      <WrappedProgress :seen="2" />
      <div class="flex flex-col gap-2">
        <p class="text-sm text-rose-100">Hot takes</p>
        <div class="rounded-lg bg-black/25 p-2">
          <p class="text-xs text-rose-100">
            <span class="font-semibold text-white">Sam</span> loved
          </p>
          <p class="text-sm font-bold">The Holdovers</p>
          <p class="text-xs text-rose-100">Gave it 9 · others 7.5</p>
        </div>
        <div class="rounded-lg bg-black/25 p-2">
          <p class="text-xs text-rose-100">
            <span class="font-semibold text-white">Priya</span> panned
          </p>
          <p class="text-sm font-bold">Dune: Part Two</p>
          <p class="text-xs text-rose-100">Gave it 5.5 · others 7.3</p>
        </div>
      </div>
      <p class="text-xs text-rose-100">Tap to continue</p>
    </li>
    <li
      class="flex h-80 w-48 rotate-3 flex-col justify-between rounded-3xl bg-emerald-950 p-5 text-left shadow-2xl shadow-black/60"
    >
      <WrappedProgress :seen="3" />
      <div>
        <p class="text-sm text-emerald-100">Most divisive</p>
        <p class="text-xl leading-tight font-bold">Dune: Part Two</p>
        <p class="mt-2 text-sm text-emerald-100">Scores ranged from</p>
        <p class="text-3xl font-extrabold">5.5–8</p>
      </div>
      <p class="text-xs text-emerald-100">Up next: club trivia</p>
    </li>
  </ul>
</template>

<script setup lang="ts">
import WrappedProgress from "./LandingWrappedProgress.vue";
</script>
