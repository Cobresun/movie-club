<template>
  <div class="mt-6">
    <h3 class="mb-3 text-sm font-medium text-gray-400">Reviews</h3>

    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      title="Delete Comment"
      message="Are you sure you want to delete this comment? This action cannot be undone."
      @confirm="confirmDelete"
      @cancel="showDeleteConfirmation = false"
    />

    <div
      v-if="hasElements(comments)"
      ref="commentsContainer"
      class="mb-4 max-h-80 space-y-3 overflow-y-auto"
    >
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="rounded-lg bg-lowBackground p-3"
      >
        <div class="flex items-center gap-2">
          <v-avatar
            :name="comment.userName"
            :src="comment.userImage"
            :size="28"
          />
          <div class="flex flex-1 items-center gap-1 text-xs text-gray-400">
            <span class="font-medium text-gray-300">{{
              comment.userName
            }}</span>
            <span>&middot;</span>
            <span>{{ formatRelativeTime(comment.createdDate) }}</span>
            <span v-if="comment.spoiler" class="text-yellow-500">
              &middot; Spoiler
            </span>
          </div>
          <template v-if="comment.userId === currentUserId">
            <button
              class="text-gray-500 hover:text-primary"
              @click="startEditing(comment)"
            >
              <mdicon name="pencil-outline" :size="14" />
            </button>
            <button
              class="text-gray-500 hover:text-red-400"
              @click="promptDelete(comment.id)"
            >
              <mdicon name="delete-outline" :size="14" />
            </button>
          </template>
        </div>

        <!-- Editing mode -->
        <div v-if="editingCommentId === comment.id" class="mt-2">
          <textarea
            v-model="editContent"
            :maxlength="MAX_LENGTH"
            class="w-full resize-none rounded-lg border border-gray-600 bg-background px-3 py-2 text-left text-sm text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows="3"
          />
          <div class="mt-2 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <label class="flex items-center gap-1.5 text-xs text-gray-400">
                <input
                  v-model="editSpoiler"
                  type="checkbox"
                  class="accent-primary"
                />
                Spoiler
              </label>
              <span
                class="text-xs"
                :class="
                  editContent.length > MAX_LENGTH * 0.9
                    ? 'text-red-400'
                    : 'text-gray-500'
                "
              >
                {{ editContent.length }}/{{ MAX_LENGTH }}
              </span>
            </div>
            <div class="flex gap-2">
              <button
                class="rounded bg-gray-600 px-3 py-1 text-xs text-white"
                @click="cancelEditing"
              >
                Cancel
              </button>
              <button
                class="rounded bg-primary px-3 py-1 text-xs text-white"
                :disabled="
                  !hasValue(editContent.trim()) ||
                  editContent.length > MAX_LENGTH
                "
                @click="saveEdit(comment.id)"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <!-- Display mode -->
        <div v-else class="mt-2">
          <p
            v-if="
              comment.spoiler &&
              comment.userId !== currentUserId &&
              !revealedSpoilers.has(comment.id)
            "
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

    <p v-else class="mb-4 text-sm text-gray-500">
      No written reviews yet. Be the first to share your thoughts!
    </p>

    <div>
      <textarea
        v-model="newComment"
        :maxlength="MAX_LENGTH"
        placeholder="Write your review…"
        class="w-full resize-none rounded-lg border border-gray-600 bg-lowBackground px-3 py-2 text-left text-sm text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        rows="3"
      />
      <div class="mt-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 text-xs text-gray-400">
            <input
              v-model="newSpoiler"
              type="checkbox"
              class="accent-primary"
            />
            Spoiler
          </label>
          <span
            class="text-xs"
            :class="
              newComment.length > MAX_LENGTH * 0.9
                ? 'text-red-400'
                : 'text-gray-500'
            "
          >
            {{ newComment.length }}/{{ MAX_LENGTH }}
          </span>
        </div>
        <v-btn
          :disabled="
            !hasValue(newComment.trim()) || newComment.length > MAX_LENGTH
          "
          @click="sendComment"
        >
          <mdicon name="send" :size="18" />
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { nextTick, reactive, ref } from "vue";

import { hasElements, hasValue } from "../../../../lib/checks/checks.js";
import { WorkCommentDto } from "../../../../lib/types/lists";

import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import {
  useAddReviewComment,
  useDeleteReviewComment,
  useEditReviewComment,
  useReviewComments,
} from "@/service/useReviews";
import { useUser } from "@/service/useUser";

const MAX_LENGTH = 2000;

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
const { mutate: editComment } = useEditReviewComment(
  props.clubSlug,
  props.workId,
);
const { mutate: removeComment } = useDeleteReviewComment(
  props.clubSlug,
  props.workId,
);

const newComment = ref("");
const newSpoiler = ref(false);
const commentsContainer = ref<HTMLDivElement | null>(null);

const editingCommentId = ref<string | null>(null);
const editContent = ref("");
const editSpoiler = ref(false);

const revealedSpoilers = reactive(new Set<string>());

const showDeleteConfirmation = ref(false);
const pendingDeleteId = ref<string | null>(null);

const sendComment = () => {
  const content = newComment.value.trim();
  if (!hasValue(content)) return;
  addComment(
    { content, spoiler: newSpoiler.value },
    {
      onSettled: () => {
        nextTick(() => {
          if (commentsContainer.value !== null) {
            commentsContainer.value.scrollTop =
              commentsContainer.value.scrollHeight;
          }
        }).catch(console.error);
      },
    },
  );
  newComment.value = "";
  newSpoiler.value = false;
};

const startEditing = (comment: WorkCommentDto) => {
  editingCommentId.value = comment.id;
  editContent.value = comment.content;
  editSpoiler.value = comment.spoiler;
};

const cancelEditing = () => {
  editingCommentId.value = null;
  editContent.value = "";
  editSpoiler.value = false;
};

const saveEdit = (commentId: string) => {
  const content = editContent.value.trim();
  if (!hasValue(content)) return;
  editComment({ commentId, content, spoiler: editSpoiler.value });
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

const formatRelativeTime = (dateString: string) => {
  return DateTime.fromISO(dateString).toRelative() ?? dateString;
};
</script>
