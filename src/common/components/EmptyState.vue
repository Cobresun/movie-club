<script setup lang="ts">
interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: string;
}

defineProps<Props>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-8 py-16 text-center transition-opacity duration-300 ease-in-out md:py-24"
  >
    <h2 class="mb-3 text-2xl font-bold text-white">{{ title }}</h2>
    <p class="mb-6 max-w-md text-base text-gray-400">{{ description }}</p>
    <v-btn v-if="actionLabel" @click="emit('action')">
      {{ actionLabel }}
      <mdicon v-if="actionIcon" :name="actionIcon" />
    </v-btn>
  </div>
</template>
