<template>
  <div class="mt-6">
    <SectionHeader title="Comments" />

    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      title="Delete Comment"
      message="Are you sure you want to delete this comment? This action cannot be undone."
      @confirm="confirmDelete"
      @cancel="showDeleteConfirmation = false"
    />

    <div v-if="hasElements(comments)" ref="commentsContainer" class="mb-4 max-h-80 overflow-y-auto">
      <!-- Not `appear`: the thread loads in place, and only comments added
           after that rise in. -->
      <TransitionGroup
        tag="div"
        class="space-y-3"
        enter-active-class="transition duration-slow ease-emphasized"
        enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition-opacity duration-base ease-standard"
        leave-to-class="opacity-0"
      >
        <div v-for="comment in comments" :key="comment.id" class="bg-lowBackground rounded-lg p-3">
          <div class="flex items-center gap-2">
            <v-avatar :name="comment.userName" :src="comment.userImage" :size="28" />
            <div class="flex flex-1 items-center gap-1 text-xs text-gray-400">
              <span class="font-medium text-gray-300">{{ comment.userName }}</span>
              <span>&middot;</span>
              <span>{{ formatRelativeTime(comment.createdDate) }}</span>
              <span v-if="comment.spoiler" class="text-yellow-500"> &middot; Spoiler </span>
            </div>
            <template v-if="comment.userId === currentUserId">
              <button
                aria-label="Edit comment"
                class="hover:text-primary text-gray-500"
                @click="startEditing(comment)"
              >
                <mdicon name="pencil-outline" :size="14" />
              </button>
              <button
                aria-label="Delete comment"
                class="text-gray-500 hover:text-red-400"
                @click="promptDelete(comment.id)"
              >
                <mdicon name="delete-outline" :size="14" />
              </button>
            </template>
          </div>

          <CommentComposer
            v-if="editingCommentId === comment.id"
            v-model:content="editContent"
            v-model:spoiler="editSpoiler"
            v-model:gif-id="editGifId"
            nested
            class="mt-2"
          >
            <template #default="{ canSubmit }">
              <div class="flex gap-2">
                <button
                  class="rounded bg-gray-600 px-3 py-1 text-xs text-white"
                  @click="cancelEditing"
                >
                  Cancel
                </button>
                <button
                  class="bg-primary rounded px-3 py-1 text-xs text-white"
                  :disabled="!canSubmit"
                  @click="saveEdit(comment.id)"
                >
                  Save
                </button>
              </div>
            </template>
          </CommentComposer>

          <!-- `blur-xs` is a purely visual filter, so while hidden it also
               carries aria-hidden: without it the spoiler is read out in full
               to a screen reader that cannot see the blur. One element for
               both states, so the blur can transition away. -->
          <div
            v-else
            :aria-hidden="isSpoilerHidden(comment) || undefined"
            class="duration-slow ease-standard mt-2 space-y-2 transition-[filter]"
            :class="isSpoilerHidden(comment) ? 'cursor-pointer blur-xs select-none' : 'blur-none'"
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
      </TransitionGroup>
    </div>

    <p v-else class="mb-4 text-sm text-gray-500">
      No comments yet. Be the first to share your thoughts!
    </p>

    <CommentComposer
      v-model:content="newComment"
      v-model:spoiler="newSpoiler"
      v-model:gif-id="newGifId"
      placeholder="Write a comment…"
    >
      <template #default="{ canSubmit }">
        <v-btn aria-label="Send comment" :disabled="!canSubmit" @click="sendComment">
          <mdicon name="send" :size="18" />
        </v-btn>
      </template>
    </CommentComposer>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";

import { hasElements, hasValue, isDefined } from "../../../lib/checks/checks.js";
import { hasTextOrGif } from "../../../lib/comments";
import { WorkCommentDto } from "../../../lib/types/lists";
import CommentComposer from "@/common/components/CommentComposer.vue";
import CommentGif from "@/common/components/CommentGif.vue";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import SectionHeader from "@/common/components/SectionHeader.vue";
import { relativeTime } from "@/common/dates";
import {
  useAddReviewComment,
  useDeleteReviewComment,
  useEditReviewComment,
  useReviewComments,
} from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  workId: string;
  clubSlug: string;
}>();

const user = useUser();
// Computed, not a one-off `ref(user.value?.id)`: the session can resolve after
// this component mounts, and a snapshot taken at setup would leave the author
// without the edit and delete controls for their own comments.
const currentUserId = computed(() => user.value?.id);

const { data: comments } = useReviewComments(props.clubSlug, props.workId);
const { mutate: addComment } = useAddReviewComment(props.clubSlug, props.workId);
const { mutate: editComment } = useEditReviewComment(props.clubSlug, props.workId);
const { mutate: removeComment } = useDeleteReviewComment(props.clubSlug, props.workId);

const newComment = ref("");
const newSpoiler = ref(false);
const newGifId = ref<string>();
const commentsContainer = ref<HTMLDivElement | null>(null);

const editingCommentId = ref<string | null>(null);
const editContent = ref("");
const editSpoiler = ref(false);
const editGifId = ref<string>();

const revealedSpoilers = reactive(new Set<string>());

const isSpoilerHidden = (comment: WorkCommentDto) =>
  comment.spoiler && comment.userId !== currentUserId.value && !revealedSpoilers.has(comment.id);

const showDeleteConfirmation = ref(false);
const pendingDeleteId = ref<string | null>(null);

// Sending scrolls the thread to the new comment as soon as its optimistic copy
// renders, rather than once the round trip and refetch have come back. A
// nextTick after addComment would be too early: onMutate awaits cancelQueries
// before writing the optimistic copy, and the container isn't mounted until
// the thread has a comment.
const scrollToLatestPending = ref(false);
watch(
  () => comments.value?.length,
  () => {
    if (!scrollToLatestPending.value || commentsContainer.value === null) return;
    scrollToLatestPending.value = false;
    commentsContainer.value.scrollTop = commentsContainer.value.scrollHeight;
  },
  { flush: "post" },
);

const sendComment = () => {
  const content = newComment.value.trim();
  const gifId = newGifId.value;
  if (!hasTextOrGif({ content, gifId })) return;
  scrollToLatestPending.value = true;
  addComment({ content, gifId, spoiler: newSpoiler.value });
  newComment.value = "";
  newSpoiler.value = false;
  newGifId.value = undefined;
};

const startEditing = (comment: WorkCommentDto) => {
  editingCommentId.value = comment.id;
  editContent.value = comment.content;
  editSpoiler.value = comment.spoiler;
  editGifId.value = comment.gifId;
};

const cancelEditing = () => {
  editingCommentId.value = null;
  editContent.value = "";
  editSpoiler.value = false;
  editGifId.value = undefined;
};

const saveEdit = (commentId: string) => {
  const content = editContent.value.trim();
  const gifId = editGifId.value;
  if (!hasTextOrGif({ content, gifId })) return;
  editComment({ commentId, content, gifId, spoiler: editSpoiler.value });
  cancelEditing();
};

const promptDelete = (commentId: string) => {
  pendingDeleteId.value = commentId;
  showDeleteConfirmation.value = true;
};

const confirmDelete = () => {
  if (pendingDeleteId.value !== null) {
    removeComment(pendingDeleteId.value);
  }
  showDeleteConfirmation.value = false;
  pendingDeleteId.value = null;
};

const formatRelativeTime = (dateString: string) => relativeTime(dateString) ?? dateString;
</script>
