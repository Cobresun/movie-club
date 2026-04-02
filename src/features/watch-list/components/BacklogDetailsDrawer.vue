<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" @close="close">
      <div class="flex-grow px-4 pb-8">
        <BacklogDetailsContent
          :movie="movie"
          :is-desktop="isDesktop"
          @close="close"
          @move-to-watchlist="emit('move-to-watchlist')"
          @delete="emit('delete')"
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
        <!-- Close button (desktop only) -->
        <button class="absolute right-4 top-4 z-10" @click="close">
          <mdicon name="close" />
        </button>

        <BacklogDetailsContent
          :movie="movie"
          :is-desktop="isDesktop"
          @close="close"
          @move-to-watchlist="emit('move-to-watchlist')"
          @delete="emit('delete')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import BacklogDetailsContent from "./BacklogDetailsContent.vue";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import VBottomSheet from "@/common/components/VBottomSheet.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{
  movie: DetailedWorkListItem;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "move-to-watchlist"): void;
  (e: "delete"): void;
}>();

const isDesktop = useIsDesktop();

const close = () => {
  emit("close");
};
</script>
