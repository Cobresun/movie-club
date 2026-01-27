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
    class="flex flex-col items-center justify-center text-center py-16 px-8 md:py-24 transition-opacity duration-300 ease-in-out"
  >
    <h2 class="text-2xl font-bold text-white mb-3">{{ title }}</h2>
    <p class="text-base text-gray-400 mb-6 max-w-md">{{ description }}</p>
    <v-btn
      v-if="actionLabel"
      @click="emit('action')"
    >
      {{ actionLabel }}
      <mdicon v-if="actionIcon" :name="actionIcon" />
    </v-btn>
  </div>
</template>
