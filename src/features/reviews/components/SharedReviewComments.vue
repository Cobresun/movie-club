<template>
  <div class="space-y-3">
    <h3 class="text-sm font-medium text-gray-400">Reviews</h3>
    <div v-for="comment in comments" :key="comment.id" class="rounded-lg bg-slate-800 p-4">
      <div class="flex items-center gap-2">
        <v-avatar :name="comment.userName" :src="comment.userImage" :size="28" />
        <div class="flex flex-1 items-center gap-1 text-xs text-gray-400">
          <span class="font-medium text-gray-300">{{ comment.userName }}</span>
          <span>&middot;</span>
          <span>{{ formatRelativeTime(comment.createdDate) }}</span>
          <span v-if="comment.spoiler" class="text-yellow-500"> &middot; Spoiler </span>
        </div>
      </div>
      <!-- `blur-xs` is a purely visual filter, so while hidden it also
           carries aria-hidden: without it the spoiler is read out in full to
           a screen reader that cannot see the blur. -->
      <div
        :aria-hidden="isSpoilerHidden(comment) || undefined"
        class="mt-2 space-y-2 transition-all"
        :class="{ 'cursor-pointer blur-xs select-none': isSpoilerHidden(comment) }"
        @click="revealedSpoilers.add(comment.id)"
      >
        <p
          v-if="hasValue(comment.content)"
          class="text-left text-sm whitespace-pre-wrap text-gray-200"
        >
          {{ comment.content }}
        </p>
        <CommentGif v-if="isDefined(comment.gifId)" :gif-id="comment.gifId" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { WorkCommentDto } from "../../../../lib/types/lists";
import CommentGif from "@/common/components/CommentGif.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import { relativeTime } from "@/common/dates";

defineProps<{
  comments: WorkCommentDto[];
}>();

const revealedSpoilers = reactive(new Set<string>());

const isSpoilerHidden = (comment: WorkCommentDto) =>
  comment.spoiler && !revealedSpoilers.has(comment.id);

const formatRelativeTime = (dateString: string) => relativeTime(dateString) ?? dateString;
</script>
