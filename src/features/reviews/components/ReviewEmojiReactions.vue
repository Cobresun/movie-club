<template>
  <div v-if="reviewId" class="mt-6">
    <h3 class="text-lg font-semibold text-white">Your Reaction</h3>
    <div class="mt-2 flex items-center justify-center gap-2">
      <button
        v-for="option in emojiOptions"
        :key="option"
        class="rounded-full p-2 text-2xl transition hover:bg-gray-700"
        :class="{ 'bg-primary/50': currentEmoji === option }"
        @click="
          currentEmoji === option ? updateEmoji(null) : updateEmoji(option)
        "
      >
        {{ option }}
      </button>
      <div ref="emojiPickerContainerRef" class="relative" @click.stop>
        <button
          v-if="!isEmojiPickerOpen"
          class="rounded-full p-2 transition hover:bg-gray-700"
          @click="isEmojiPickerOpen = true"
        >
          <mdicon name="plus-circle-outline" />
        </button>
        <div
          v-else
          class="absolute bottom-full right-0 z-10 mb-2 rounded-lg border border-gray-600 bg-background shadow-xl"
        >
          <EmojiPicker
            :native="true"
            :hide-group-names="false"
            :hide-search="false"
            :disable-skin-tones="true"
            theme="dark"
            @select="onEmojiSelect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import EmojiPicker from "vue3-emoji-picker";
import "vue3-emoji-picker/css";

import { isDefined } from "../../../../lib/checks/checks.js";

import { useUpdateReviewEmoji } from "@/service/useReviews";

const BASE_EMOJIS = ["👍", "❤️", "😂", "🤔", "👎"];

const props = defineProps<{
  clubSlug: string;
  reviewId: string | undefined;
  emoji: string | null | undefined;
}>();

const { mutate: updateReviewEmoji } = useUpdateReviewEmoji(props.clubSlug);

const isEmojiPickerOpen = ref(false);
const emojiPickerContainerRef = ref<HTMLElement | null>(null);

const currentEmoji = computed(() => props.emoji ?? null);

const emojiOptions = computed(() => {
  if (
    isDefined(currentEmoji.value) &&
    !BASE_EMOJIS.includes(currentEmoji.value)
  ) {
    return [...BASE_EMOJIS, currentEmoji.value];
  }
  return BASE_EMOJIS;
});

const updateEmoji = (emoji: string | null) => {
  if (!isDefined(props.reviewId)) return;
  updateReviewEmoji({ reviewId: props.reviewId, emoji });
};

const onEmojiSelect = (emoji: { i: string }) => {
  updateEmoji(emoji.i);
  isEmojiPickerOpen.value = false;
};

const handleClickOutsideEmojiPicker = (event: MouseEvent) => {
  if (
    isEmojiPickerOpen.value &&
    emojiPickerContainerRef.value &&
    !emojiPickerContainerRef.value.contains(event.target as Node)
  ) {
    isEmojiPickerOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutsideEmojiPicker);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutsideEmojiPicker);
});
</script>
