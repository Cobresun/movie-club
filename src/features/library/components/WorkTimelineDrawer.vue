<template>
  <div>
    <!-- Mobile bottom sheet -->
    <v-bottom-sheet v-if="!isDesktop" @close="emit('close')">
      <WorkTimelineContent
        :work="work"
        :is-desktop="isDesktop"
        @edit="(entry) => emit('edit', entry)"
        @delete="(entry) => emit('delete', entry)"
      />
    </v-bottom-sheet>

    <!-- Desktop side drawer -->
    <VSideDrawer v-if="isDesktop" @close="emit('close')">
      <WorkTimelineContent
        :work="work"
        :is-desktop="isDesktop"
        @edit="(entry) => emit('edit', entry)"
        @delete="(entry) => emit('delete', entry)"
      />
    </VSideDrawer>
  </div>
</template>

<script setup lang="ts">
import WorkTimelineContent from "./WorkTimelineContent.vue";
import type { DiaryEntry } from "../../../../lib/types/me";
import type { LibraryWork } from "../worksGrouping";

import VBottomSheet from "@/common/components/VBottomSheet.vue";
import VSideDrawer from "@/common/components/VSideDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{ work: LibraryWork }>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "edit", entry: DiaryEntry): void;
  (e: "delete", entry: DiaryEntry): void;
}>();

const isDesktop = useIsDesktop();
</script>
