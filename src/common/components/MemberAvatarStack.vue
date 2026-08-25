<template>
  <div v-if="hasElements(shown)" class="flex flex-shrink-0 items-center">
    <div
      v-for="(member, index) in shown"
      :key="member.id"
      class="rounded-full"
      :class="[ringClass, index === 0 ? '' : '-ml-2']"
    >
      <v-avatar :src="member.image" :name="member.name" :size="size" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements } from "../../../lib/checks/checks.js";
import { Member } from "../../../lib/types/club";

const MAX_AVATARS = 3;

const {
  members,
  size,
  ringClass = "",
} = defineProps<{
  members: readonly Member[] | undefined;
  size: number;
  /** Tailwind box-shadow ring in the surrounding surface's own colour. */
  ringClass?: string;
}>();

const shown = computed(() => members?.slice(0, MAX_AVATARS));
</script>
