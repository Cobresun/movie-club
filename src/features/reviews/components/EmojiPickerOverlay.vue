<template>
  <Teleport to="body">
    <Transition name="emoji-overlay">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a reaction"
        @click="emit('close')"
      >
        <div
          class="emoji-picker-panel w-full max-w-sm overflow-hidden rounded-2xl border border-gray-600/80 bg-background shadow-2xl"
          @click.stop
        >
          <div
            class="flex items-center justify-between border-b border-gray-700/80 px-4 py-3"
          >
            <h2 class="text-base font-semibold text-white">Pick a reaction</h2>
            <button
              type="button"
              class="rounded-full p-1.5 text-gray-400 transition hover:bg-slate-700 hover:text-white"
              aria-label="Close"
              @click="emit('close')"
            >
              <mdicon name="close" :size="20" />
            </button>
          </div>

          <div
            v-if="isDefined(currentEmoji)"
            class="flex items-center justify-between gap-3 border-b border-gray-700/60 bg-lowBackground/60 px-4 py-2.5"
          >
            <div class="flex items-center gap-2.5 text-sm text-gray-300">
              <span>Current</span>
              <span class="text-2xl leading-none">{{ currentEmoji }}</span>
            </div>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
              @click="emit('clear')"
            >
              Remove
            </button>
          </div>

          <div class="emoji-picker-themed px-1 pb-1 pt-2">
            <EmojiPicker
              :native="true"
              :hide-group-names="true"
              :hide-search="false"
              :disable-skin-tones="true"
              :display-recent="true"
              :disable-sticky-group-names="true"
              theme="dark"
              :static-texts="{ placeholder: 'Search emojis...' }"
              @select="onSelect"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, watch } from "vue";
import EmojiPicker from "vue3-emoji-picker";
import "vue3-emoji-picker/css";

import { isDefined } from "../../../../lib/checks/checks.js";

const props = defineProps<{
  open: boolean;
  currentEmoji?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "select", emoji: string): void;
  (e: "clear"): void;
}>();

const onSelect = (emoji: { i: string }) => {
  emit("select", emoji.i);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    emit("close");
  }
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeydown);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = "";
    }
  },
);

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.emoji-picker-themed :deep(.v3-emoji-picker) {
  --v3-picker-bg: #222831;
  --v3-picker-fg: #ffffff;
  --v3-picker-border: #393e46;
  --v3-picker-input-bg: #393e46;
  --v3-picker-input-border: #4b5563;
  --v3-picker-input-focus-border: #2196f3;
  --v3-picker-emoji-hover: #393e46;
  width: 100%;
  height: 340px;
  box-shadow: none;
  border-radius: 0;
  margin: 0;
}

.emoji-picker-themed :deep(.v3-emoji-picker .v3-header) {
  padding-top: 0;
}

.emoji-overlay-enter-active,
.emoji-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.emoji-overlay-enter-active .emoji-picker-panel,
.emoji-overlay-leave-active .emoji-picker-panel {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.emoji-overlay-enter-from,
.emoji-overlay-leave-to {
  opacity: 0;
}

.emoji-overlay-enter-from .emoji-picker-panel,
.emoji-overlay-leave-to .emoji-picker-panel {
  transform: translateY(1rem) scale(0.98);
  opacity: 0;
}

@media (min-width: 640px) {
  .emoji-overlay-enter-from .emoji-picker-panel,
  .emoji-overlay-leave-to .emoji-picker-panel {
    transform: scale(0.96);
  }
}
</style>
