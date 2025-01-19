<template>
  <div
    class="relative mb-4 w-40 rounded"
    :class="[
      highlighted
        ? 'border-4 border-highlightBackground'
        : 'border-2 border-gray-200',
    ]"
  >
    <button
      v-if="showDelete"
      class="absolute -right-3 -top-3 rounded-full bg-background"
      @click="emit('delete')"
    >
      <mdicon name="close-circle-outline" />
    </button>
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="absolute inset-0 bg-background opacity-50" />
      <loading-spinner />
    </div>
    <div class="flex h-full flex-col bg-background">
      <img v-lazy-load :src="moviePosterUrl" />
      <div class="flex h-auto flex-grow flex-col px-2 pb-2">
        <div class="my-2 flex flex-grow items-center justify-center">
          <h3 class="h-min font-semibold" style="height: min-content">
            {{ movieTitle }}
          </h3>
        </div>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  movieTitle,
  moviePosterUrl,
  highlighted = false,
  showDelete = false,
} = defineProps<{
  movieTitle: string;
  moviePosterUrl: string;
  highlighted?: boolean;
  showDelete?: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{ (e: "delete"): void }>();
</script>
