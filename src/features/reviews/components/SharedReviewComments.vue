<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-gray-400">Reviews</h3>
    <div
      v-for="comment in comments"
      :key="comment.id"
      class="rounded-lg bg-slate-800 p-4"
    >
      <div class="flex items-center gap-2">
        <v-avatar
          :name="comment.userName"
          :src="comment.userImage"
          :size="28"
        />
        <div class="flex flex-1 items-center gap-1 text-xs text-gray-400">
          <span class="font-medium text-gray-300">{{ comment.userName }}</span>
          <span>&middot;</span>
          <span>{{ formatRelativeTime(comment.createdDate) }}</span>
          <span v-if="comment.spoiler" class="text-yellow-500">
            &middot; Spoiler
          </span>
        </div>
      </div>
      <div class="mt-2">
        <p
          v-if="comment.spoiler && !revealedSpoilers.has(comment.id)"
          class="cursor-pointer select-none whitespace-pre-wrap text-left text-sm text-gray-200 blur-sm transition-all"
          @click="revealedSpoilers.add(comment.id)"
        >
          {{ comment.content }}
        </p>
        <p v-else class="whitespace-pre-wrap text-left text-sm text-gray-200">
          {{ comment.content }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { reactive } from "vue";

import { WorkCommentDto } from "../../../../lib/types/lists";

import VAvatar from "@/common/components/VAvatar.vue";

defineProps<{
  comments: WorkCommentDto[];
}>();

const revealedSpoilers = reactive(new Set<string>());

const formatRelativeTime = (dateString: string) => {
  return DateTime.fromISO(dateString).toRelative() ?? dateString;
};
</script>
