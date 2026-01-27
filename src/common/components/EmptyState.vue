<script setup lang="ts">
import { computed } from "vue";

interface Props {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionIcon?: string;
  variant?: "default" | "search";
}

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
});

const emit = defineEmits<{
  action: [];
}>();

const iconColorClass = computed(() =>
  props.variant === "search" ? "text-gray-600" : "text-gray-500"
);
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-center py-16 px-8 md:py-24 transition-opacity duration-300 ease-in-out"
  >
    <mdicon
      :name="icon"
      :class="iconColorClass"
      class="w-24 h-24 mb-4"
      aria-hidden="true"
    />
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
