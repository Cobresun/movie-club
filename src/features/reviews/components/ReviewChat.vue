<template>
  <div class="mt-6">
    <h3 class="mb-3 text-sm font-medium text-gray-400">Discussion</h3>

    <div
      v-if="hasElements(comments)"
      ref="commentsContainer"
      class="mb-4 max-h-60 space-y-3 overflow-y-auto"
    >
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="flex items-start gap-2"
        :class="{ 'flex-row-reverse': comment.userId === currentUserId }"
      >
        <v-avatar
          :name="comment.userName"
          :src="comment.userImage"
          :size="28"
        />
        <div class="max-w-[75%]">
          <div class="flex items-center gap-1 text-xs text-gray-400">
            <span>{{ comment.userName }}</span>
            <span>&middot;</span>
            <span>{{ formatRelativeTime(comment.createdDate) }}</span>
            <button
              v-if="comment.userId === currentUserId"
              class="ml-1 text-gray-500 hover:text-red-400"
              @click="deleteComment(comment.id)"
            >
              <mdicon name="delete-outline" :size="14" />
            </button>
          </div>
          <div
            class="mt-0.5 whitespace-pre-wrap rounded-lg px-3 py-2 text-sm"
            :class="
              comment.userId === currentUserId
                ? 'bg-primary/20'
                : 'bg-lowBackground'
            "
          >
            {{ comment.content }}
          </div>
        </div>
      </div>
    </div>

    <p v-else class="mb-4 text-sm text-gray-500">
      No comments yet. Start the discussion!
    </p>

    <div class="flex items-end gap-2">
      <textarea
        v-model="newComment"
        placeholder="Share your thoughts..."
        class="flex-1 resize-none rounded-lg border border-gray-600 bg-lowBackground px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        rows="1"
        @keydown.enter.exact.prevent="sendComment"
      />
      <v-btn :disabled="!hasValue(newComment.trim())" @click="sendComment">
        <mdicon name="send" :size="18" />
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { nextTick, ref } from "vue";

import { hasElements, hasValue } from "../../../../lib/checks/checks.js";

import {
  useAddReviewComment,
  useDeleteReviewComment,
  useReviewComments,
} from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  workId: string;
  clubSlug: string;
}>();

const user = useUser();
const currentUserId = ref(user.value?.id);

const { data: comments } = useReviewComments(props.clubSlug, props.workId);
const { mutate: addComment } = useAddReviewComment(
  props.clubSlug,
  props.workId,
);
const { mutate: removeComment } = useDeleteReviewComment(
  props.clubSlug,
  props.workId,
);

const newComment = ref("");
const commentsContainer = ref<HTMLDivElement | null>(null);

const sendComment = () => {
  const content = newComment.value.trim();
  if (!hasValue(content)) return;
  addComment(content, {
    onSettled: () => {
      nextTick(() => {
        if (commentsContainer.value !== null) {
          commentsContainer.value.scrollTop =
            commentsContainer.value.scrollHeight;
        }
      }).catch(console.error);
    },
  });
  newComment.value = "";
};

const deleteComment = (commentId: string) => {
  removeComment(commentId);
};

const formatRelativeTime = (dateString: string) => {
  return DateTime.fromISO(dateString).toRelative() ?? dateString;
};
</script>
