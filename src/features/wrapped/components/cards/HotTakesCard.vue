<template>
  <ul class="flex flex-1 flex-col justify-center gap-5">
    <li v-for="take in takes" :key="take.member.id" class="flex items-center gap-3">
      <v-avatar :src="take.member.image" :name="take.member.name" :size="40" class="shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-sm">
          <span class="font-semibold">{{ firstName(take.member.name) }}</span
          >{{ " " }}<span class="text-white/75">{{ take.gap > 0 ? "loved" : "panned" }}</span>
        </p>
        <p class="truncate text-base font-bold leading-snug">{{ take.title }}</p>
        <p class="text-xs text-white/75">
          Gave it {{ take.memberScore }} · others {{ take.othersAverage.toFixed(1) }}
        </p>
      </div>
      <span class="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-sm font-bold tabular-nums">
        {{ signedGap(take.gap) }}
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { HotTake } from "../../wrapped";
import { firstName } from "@/common/memberName";

defineProps<{ takes: HotTake[] }>();

function signedGap(gap: number): string {
  return `${gap > 0 ? "+" : "−"}${Math.abs(gap).toFixed(1)}`;
}
</script>
