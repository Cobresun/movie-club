<template>
  <div
    class="rounded w-40 mb-4"
    :class="[highlighted ? 'border-4 border-highlightBackground' : 'border-2 border-gray-200']"
  >
    <div class="flex flex-col h-full">
      <img :src="moviePosterUrl">
      <div class="px-2 pb-2 flex flex-col h-auto flex-grow">
        <div class="my-2 flex flex-grow items-center justify-center">
          <h3
            class="font-semibold h-min"
            style="height: min-content"
          >
            {{ movieTitle }}
          </h3>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { movieTitle, moviePosterUrl } = defineProps<{
movieTitle: string,
moviePosterUrl: string,
highlighted: boolean
}>()
</script>
