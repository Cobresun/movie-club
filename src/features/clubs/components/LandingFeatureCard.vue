<template>
  <div
    class="bg-lowBackground duration-fast ease-standard flex flex-col items-center rounded-xl p-6 text-center transition hover:-translate-y-0.5 hover:brightness-110"
  >
    <img :src="image" :alt="title" class="mb-4 h-16 w-32 md:h-20 md:w-36" />
    <h3 class="text-highlight mb-2 text-xl font-semibold">{{ title }}</h3>
    <p class="font-light text-gray-300">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  image: string;
  title: string;
  description: string;
}>();
</script>
