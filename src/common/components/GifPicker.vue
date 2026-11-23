<template>
  <div
    role="group"
    aria-label="Choose a GIF"
    class="bg-background mt-2 rounded-lg border border-gray-600 p-2"
    @keydown.escape.stop="emit('close')"
  >
    <input
      ref="searchInput"
      v-model="query"
      type="search"
      aria-label="Search GIFs"
      placeholder="Search GIPHY"
      class="bg-lowBackground focus:border-primary focus:ring-primary w-full rounded-md border border-gray-600 px-3 py-1.5 text-base text-white placeholder-gray-400 focus:ring-1 focus:outline-hidden md:text-sm"
    />

    <p v-if="isError" class="py-4 text-center text-sm text-gray-400">Couldn't load GIFs.</p>
    <p v-else-if="isLoading" class="py-4 text-center text-sm text-gray-400">Loading GIFs…</p>
    <p v-else-if="!hasElements(gifs)" class="py-4 text-center text-sm text-gray-400">
      No GIFs found.
    </p>
    <div v-else class="mt-2 grid max-h-60 grid-cols-3 gap-1 overflow-y-auto">
      <button
        v-for="gif in gifs"
        :key="gif.id"
        type="button"
        :aria-label="hasValue(gif.title) ? gif.title : 'GIF'"
        class="focus-visible:ring-primary overflow-hidden rounded focus-visible:ring-2 focus-visible:outline-hidden"
        @click="emit('select', gif.id)"
      >
        <img
          :src="giphyImageUrl(gif.id, '100')"
          alt=""
          loading="lazy"
          class="h-20 w-full bg-gray-700 object-cover"
        />
      </button>
    </div>

    <p class="mt-2 text-right text-[10px] tracking-wide text-gray-500 uppercase">
      Powered by GIPHY
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks.js";
import { giphyImageUrl } from "../../../lib/giphy";
import { useGifSearch } from "@/service/useGiphy";

const DEBOUNCE_MS = 300;

const emit = defineEmits<{
  (e: "select", gifId: string): void;
  (e: "close"): void;
}>();

const searchInput = useTemplateRef<HTMLInputElement>("searchInput");
const query = ref("");
const debouncedQuery = ref("");

// Each keystroke would otherwise be its own GIPHY call against an hourly
// per-key limit.
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value;
  }, DEBOUNCE_MS);
});
onBeforeUnmount(() => clearTimeout(debounceTimer));

onMounted(() => searchInput.value?.focus());

const { data: gifs, isLoading, isError } = useGifSearch(debouncedQuery);
</script>
