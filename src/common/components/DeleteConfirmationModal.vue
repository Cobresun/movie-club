<template>
  <Teleport to="body">
    <v-modal v-if="show" size="sm" z-index="60" @close="emit('cancel')">
      <div class="flex flex-col gap-4">
        <h2 class="text-xl font-bold">{{ title }}</h2>
        <p>{{ message }}</p>
        <div class="flex gap-3">
          <button
            class="flex-1 rounded-md bg-gray-600 py-3 font-bold text-white hover:brightness-110 disabled:opacity-50"
            :disabled="loading"
            @click="emit('cancel')"
          >
            Cancel
          </button>
          <button
            class="flex-1 rounded-md bg-red-500 py-3 font-bold text-white hover:brightness-110 disabled:opacity-50"
            :disabled="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </v-modal>
  </Teleport>
</template>

<script setup lang="ts">
const {
  show,
  title = "Remove from List",
  message = "Are you sure you want to remove this item from the list?",
  confirmLabel = "Delete",
  loading = false,
} = defineProps<{
  show: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm" | "cancel"): void;
}>();
</script>
