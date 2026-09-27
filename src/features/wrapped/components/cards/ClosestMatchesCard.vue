<template>
  <ul class="flex flex-1 flex-col justify-center gap-5">
    <li v-for="match in matches" :key="match.member.id" class="flex items-center gap-3">
      <div class="flex shrink-0 -space-x-2">
        <v-avatar :src="match.member.image" :name="match.member.name" :size="40" />
        <v-avatar :src="match.match.image" :name="match.match.name" :size="40" />
      </div>
      <p class="min-w-0 flex-1 text-sm leading-snug">
        <span class="font-semibold">{{ firstName(match.member.name) }}</span
        >{{ " " }}<span class="text-white/75">is closest to</span>{{ " "
        }}<span class="font-semibold">{{ firstName(match.match.name) }}</span>
      </p>
      <span class="shrink-0 text-xl font-bold tabular-nums">
        {{ Math.round(match.similarityPercent) }}%
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { ClosestMatch } from "../../wrapped";
import { firstName } from "@/common/memberName";

defineProps<{ matches: ClosestMatch[] }>();
</script>
