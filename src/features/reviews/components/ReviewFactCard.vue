<template>
  <!-- Gradient-border wrapper: a 1px animated-feel frame plus a soft primary
       glow gives the fact "special event" treatment without stealing the
       whole drawer's attention. -->
  <div
    class="rounded-xl bg-gradient-to-r from-primary/80 via-sky-300/60 to-violet-400/80 p-px shadow-[0_0_24px_rgba(33,150,243,0.18)]"
  >
    <div class="flex items-center gap-3 rounded-[calc(0.75rem-1px)] bg-background px-4 py-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
      >
        <mdicon :name="fact.icon" size="22" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-primary">
          {{ fact.label }}
        </p>
        <p class="text-sm leading-snug text-gray-200">{{ fact.text }}</p>
      </div>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-primary/15 hover:text-primary"
        aria-label="Share this review"
        @click="emit('share')"
      >
        <mdicon name="share-variant" size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReviewFact } from "../reviewFacts";

defineProps<{ fact: ReviewFact }>();

const emit = defineEmits<{ (e: "share"): void }>();
</script>
