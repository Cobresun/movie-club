<template>
  <!-- Gradient-border wrapper: a 1px animated-feel frame plus a soft primary
       glow gives the fact "special event" treatment without stealing the
       whole drawer's attention. -->
  <div
    class="from-primary/80 rounded-xl bg-linear-to-r via-sky-300/60 to-violet-400/80 p-px shadow-[0_0_24px_rgba(33,150,243,0.18)]"
  >
    <div class="bg-background flex items-center gap-3 rounded-[calc(0.75rem-1px)] px-4 py-3">
      <div
        class="bg-primary/15 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      >
        <mdicon :name="fact.icon" size="22" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-primary text-[11px] font-semibold tracking-wider uppercase">
          {{ fact.label }}
        </p>
        <p class="text-sm leading-snug text-gray-200">{{ fact.text }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ReviewFact } from "../reviewFacts";

defineProps<{ fact: ReviewFact }>();
</script>
