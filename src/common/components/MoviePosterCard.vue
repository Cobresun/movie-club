<template>
  <div
    class="relative rounded w-40 mb-4"
    :class="[
      highlighted
        ? 'border-4 border-highlightBackground'
        : 'border-2 border-gray-200',
    ]"
  >
    <button
      v-if="showDelete"
      class="absolute -top-3 -right-3 bg-background rounded-full"
      @click="emit('delete')"
    >
      <mdicon name="close-circle-outline" />
    </button>
    <div class="flex flex-col h-full bg-background">
      <img v-lazy-load :src="moviePosterUrl" :alt="movieTitle" />
      <div class="px-2 pb-2 flex flex-col h-auto flex-grow">
        <div class="my-2 flex flex-grow items-center justify-center">
          <h3 class="font-semibold h-min" style="height: min-content">
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
}>();

const emit = defineEmits<{ (e: "delete"): void }>();
</script>
