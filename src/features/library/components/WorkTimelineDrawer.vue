<template>
  <div>
    <!-- Mobile bottom sheet -->
    <v-bottom-sheet v-if="!isDesktop" @close="emit('close')">
      <WorkTimelineContent
        :work="work"
        :is-desktop="isDesktop"
        @edit="(watch) => emit('edit', watch)"
        @delete="(watch) => emit('delete', watch)"
      />
    </v-bottom-sheet>

    <!-- Desktop side drawer -->
    <VSideDrawer v-if="isDesktop" @close="emit('close')">
      <WorkTimelineContent
        :work="work"
        :is-desktop="isDesktop"
        @edit="(watch) => emit('edit', watch)"
        @delete="(watch) => emit('delete', watch)"
      />
    </VSideDrawer>
  </div>
</template>

<script setup lang="ts">
import WorkTimelineContent from "./WorkTimelineContent.vue";
import type { DiaryWatch } from "../../../../lib/types/me";
import type { LibraryWork } from "../worksGrouping";

import VBottomSheet from "@/common/components/VBottomSheet.vue";
import VSideDrawer from "@/common/components/VSideDrawer.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop.js";

defineProps<{ work: LibraryWork }>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "edit", watch: DiaryWatch): void;
  (e: "delete", watch: DiaryWatch): void;
}>();

const isDesktop = useIsDesktop();
</script>
