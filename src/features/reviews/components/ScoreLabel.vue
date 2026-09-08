<template>
  <div class="flex min-w-0 items-center gap-2">
    <VAvatar v-if="isDefined(entry.memberId)" :src="entry.image" :name="entry.name" :size="28" />
    <img v-else :src="AverageImg" class="h-7 w-7 max-w-none" />
    <!-- Score chips are narrow, so the first name is all that fits — the
         avatar carries the rest. -->
    <span v-if="showName" class="truncate">{{ shortName }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ScoreEntry } from "../reviewScores";
import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import { firstName } from "@/common/memberName";

const props = defineProps<{
  entry: ScoreEntry;
  showName?: boolean;
}>();

const shortName = computed(() =>
  isDefined(props.entry.memberId) ? firstName(props.entry.name) : props.entry.name,
);
</script>
