<template>
  <section
    aria-labelledby="wrapped-entry-heading"
    class="mx-auto mt-4 flex w-11/12 flex-col gap-3 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-800 to-slate-900 p-4 text-left sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-3">
      <mdicon name="creation" :size="28" class="shrink-0" />
      <div>
        <h2 id="wrapped-entry-heading" class="text-lg font-bold">Club Wrapped</h2>
        <p class="text-sm text-white/80">Each year's highlights as shareable story cards.</p>
      </div>
    </div>
    <ul class="flex flex-wrap gap-2">
      <li v-for="year in years" :key="year">
        <router-link
          :to="{ name: 'Wrapped', params: { clubSlug, year } }"
          :aria-label="`${year} Wrapped`"
          class="block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold transition-colors duration-fast ease-standard hover:bg-white/25"
        >
          {{ year }}
        </router-link>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{ clubSlug: string; years: number[] }>();
</script>
