<template>
  <Teleport to="body">
    <v-modal v-if="show" size="sm" z-index="60" @close="emit('cancel')">
      <div class="flex flex-col gap-4">
        <h2 class="text-xl font-bold">{{ title }}</h2>
        <p>{{ message }}</p>
        <div class="flex gap-3">
          <button
            class="flex-1 rounded-md bg-gray-600 py-3 font-bold text-white hover:brightness-110"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="flex-1 rounded-md bg-red-500 py-3 font-bold text-white hover:brightness-110"
            @click="emit('confirm')"
          >
            Delete
          </button>
        </div>
      </div>
    </v-modal>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    show: boolean;
    title?: string;
    message?: string;
  }>(),
  {
    title: "Delete Review",
    message: "Are you sure you want to delete this review? This action cannot be undone.",
  },
);

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>
