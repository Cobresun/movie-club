<template>
  <span
    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
    :class="
      isSolo ? 'bg-primary/20 text-highlight' : 'bg-slate-700 text-gray-300'
    "
  >
    <mdicon v-if="isSolo" :name="soloIcon" :size="12" />
    <mdicon v-else name="account-group-outline" :size="12" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../../lib/checks/checks";

import { USER_SCOPE } from "@/common/scope";

// No club name = the solo library chip. Solo vs club is a scope dimension, not
// a club-type one: the solo side reads its label/icon from the USER_SCOPE
// registry, the club side from the given club name. There is no registry to
// route this through.
const { clubName } = defineProps<{ clubName?: string }>();

const isSolo = computed(() => !hasValue(clubName));
const soloIcon = USER_SCOPE.icon;
const label = computed(() =>
  hasValue(clubName) ? clubName : USER_SCOPE.label,
);
</script>
