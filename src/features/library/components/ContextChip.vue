<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="
      isSolo
        ? 'bg-highlightBackground text-highlight'
        : 'bg-slate-700 text-gray-300'
    "
  >
    <mdicon v-if="isSolo" :name="soloIcon" :size="12" />
    <mdicon v-else name="account-group-outline" :size="12" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { DiaryContext } from "../../../../lib/types/me";

import { USER_SCOPE } from "@/common/scope";

const { context } = defineProps<{ context: DiaryContext }>();

// Solo vs club is a scope dimension, not a club-type one: the solo side reads
// its label/icon from the USER_SCOPE registry, the club side from the row's
// own context. There is no registry to route this through.
const isSolo = computed(() => context.kind === "solo");
const soloIcon = USER_SCOPE.icon;
const label = computed(() =>
  context.kind === "solo" ? USER_SCOPE.label : context.clubName,
);
</script>
