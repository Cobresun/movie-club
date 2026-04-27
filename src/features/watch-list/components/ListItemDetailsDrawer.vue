<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" @close="close">
      <div class="flex-grow px-4 pb-8">
        <ListItemDetailsContent
          :movie="movie"
          :is-next-work="isNextWork"
          :is-desktop="isDesktop"
          :can-review="canReview"
          :other-lists="otherLists"
          @close="close"
          @review="emit('review')"
          @set-next-work="emit('set-next-work')"
          @clear-next-work="emit('clear-next-work')"
          @delete="emit('delete')"
          @move-to-list="(id) => emit('move-to-list', id)"
        />
      </div>
    </v-bottom-sheet>

    <!-- Desktop Drawer (side panel) -->
    <div
      v-if="isDesktop"
      class="fixed inset-y-0 right-0 z-50 w-[35vw] max-w-full transform bg-background md:border-l md:border-gray-700 md:shadow-xl"
      @click.stop
    >
      <div class="relative h-full overflow-y-auto px-4 pt-8">
        <button class="absolute right-4 top-4 z-10" @click="close">
          <mdicon name="close" />
        </button>

        <ListItemDetailsContent
          :movie="movie"
          :is-next-work="isNextWork"
          :is-desktop="isDesktop"
          :can-review="canReview"
          :other-lists="otherLists"
          @close="close"
          @review="emit('review')"
          @set-next-work="emit('set-next-work')"
          @clear-next-work="emit('clear-next-work')"
          @delete="emit('delete')"
          @move-to-list="(id) => emit('move-to-list', id)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ListItemDetailsContent from "./ListItemDetailsContent.vue";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import VBottomSheet from "@/common/components/VBottomSheet.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{
  movie: DetailedWorkListItem;
  isNextWork: boolean;
  canReview: boolean;
  otherLists: { id: string; title: string }[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "review"): void;
  (e: "set-next-work"): void;
  (e: "clear-next-work"): void;
  (e: "delete"): void;
  (e: "move-to-list", listId: string): void;
}>();

const isDesktop = useIsDesktop();

const close = () => {
  emit("close");
};
</script>
