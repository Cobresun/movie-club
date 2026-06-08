<template>
  <div>
    <!-- Mobile Bottom Sheet -->
    <v-bottom-sheet v-if="!isDesktop" transparent-handle @close="close">
      <ListItemDetailsContent
        :movie="movie"
        :club-slug="clubSlug"
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
    </v-bottom-sheet>

    <!-- Desktop Drawer (side panel) -->
    <VSideDrawer v-if="isDesktop" @close="close">
      <ListItemDetailsContent
        :movie="movie"
        :club-slug="clubSlug"
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
    </VSideDrawer>
  </div>
</template>

<script setup lang="ts">
import ListItemDetailsContent from "./ListItemDetailsContent.vue";
import { DetailedWorkListItem } from "../../../../lib/types/lists.js";

import VBottomSheet from "@/common/components/VBottomSheet.vue";
import VSideDrawer from "@/common/components/VSideDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{
  movie: DetailedWorkListItem;
  clubSlug: string;
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
