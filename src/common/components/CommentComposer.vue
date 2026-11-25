<template>
  <div>
    <textarea
      v-model="content"
      :maxlength="MAX_COMMENT_LENGTH"
      :placeholder="placeholder"
      class="focus:border-primary focus:ring-primary w-full resize-none rounded-lg border border-gray-600 px-3 py-2 text-left text-base text-white placeholder-gray-400 focus:ring-1 focus:outline-hidden md:text-sm"
      :class="nested ? 'bg-background' : 'bg-lowBackground'"
      rows="3"
    />

    <div v-if="isDefined(gifId)" class="relative mt-1 w-fit">
      <CommentGif :gif-id="gifId" />
      <button
        type="button"
        aria-label="Remove GIF"
        class="absolute top-1 right-1 flex rounded-full bg-black/70 p-0.5 text-white hover:bg-black"
        @click="gifId = undefined"
      >
        <mdicon name="close" :size="16" />
      </button>
    </div>

    <GifPicker v-if="pickerOpen" @select="chooseGif" @close="closePicker" />

    <div class="mt-2 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-1.5 text-xs text-gray-400">
          <input v-model="spoiler" type="checkbox" class="accent-primary" />
          Spoiler
        </label>
        <button
          ref="gifToggle"
          type="button"
          aria-label="Add a GIF"
          :aria-expanded="pickerOpen"
          class="rounded border px-1.5 text-[11px] leading-4 font-bold"
          :class="
            pickerOpen
              ? 'border-primary text-primary'
              : 'border-gray-600 text-gray-400 hover:text-white'
          "
          @click="pickerOpen = !pickerOpen"
        >
          GIF
        </button>
        <span
          class="text-xs"
          :class="content.length > MAX_COMMENT_LENGTH * 0.9 ? 'text-red-400' : 'text-gray-500'"
        >
          {{ content.length }}/{{ MAX_COMMENT_LENGTH }}
        </span>
      </div>
      <slot :can-submit="canSubmit" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";

import { isDefined } from "../../../lib/checks/checks.js";
import { hasTextOrGif, MAX_COMMENT_LENGTH } from "../../../lib/comments";
import CommentGif from "@/common/components/CommentGif.vue";
import GifPicker from "@/common/components/GifPicker.vue";

/**
 * A comment's text, GIF and spoiler flag, for writing a new comment or
 * editing one. The submit control is the caller's, in the default slot, which
 * is told whether the comment as it stands would be accepted.
 */
const { placeholder = undefined, nested = false } = defineProps<{
  placeholder?: string;
  /** Inside a comment card, which already has the low background. */
  nested?: boolean;
}>();

const content = defineModel<string>("content", { required: true });
const spoiler = defineModel<boolean>("spoiler", { required: true });
const gifId = defineModel<string | undefined>("gifId");

const pickerOpen = ref(false);
const gifToggle = useTemplateRef<HTMLButtonElement>("gifToggle");

const canSubmit = computed(
  () =>
    hasTextOrGif({ content: content.value, gifId: gifId.value }) &&
    content.value.length <= MAX_COMMENT_LENGTH,
);

const chooseGif = (id: string) => {
  gifId.value = id;
  pickerOpen.value = false;
};

const closePicker = () => {
  pickerOpen.value = false;
  gifToggle.value?.focus();
};
</script>
