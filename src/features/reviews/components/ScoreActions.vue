<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-if="canReveal"
      type="button"
      class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
      @click="emit('reveal')"
    >
      <mdicon name="eye-outline" :size="16" />
      Reveal scores
    </button>
    <button
      v-if="canScore && hasOwnScore"
      type="button"
      class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
      @click="emit('score')"
    >
      <mdicon name="pencil" :size="16" />
      Edit your score
    </button>
    <button
      v-else-if="canScore"
      type="button"
      class="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-inset ring-primary/30 transition duration-fast ease-standard hover:bg-primary/20 active:scale-[0.98]"
      @click="emit('score')"
    >
      <mdicon name="plus" :size="16" />
      Score {{ noun }}
    </button>
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-300 transition duration-fast ease-standard hover:brightness-110"
      :aria-label="`${noun} details`"
      @click="emit('details')"
    >
      <mdicon name="comment-text-outline" :size="16" />
      <span class="hidden sm:inline">Details</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** "show", "season" or "episode" — what the buttons name. */
  noun: string;
  /** Whether the reader scored this work directly, so has a score to edit. */
  hasOwnScore: boolean;
  canScore: boolean;
  canReveal: boolean;
}>();

const emit = defineEmits<{
  (e: "score"): void;
  (e: "reveal"): void;
  (e: "details"): void;
}>();
</script>
