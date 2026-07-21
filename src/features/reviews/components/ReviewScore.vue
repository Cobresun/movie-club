<template>
  <!-- Editable inline (reviews table): the score / "+" is a popover trigger that
       opens the shared score-entry panel. -->
  <Popover v-if="canEditInline" v-slot="{ close }" as="span" class="inline-flex">
    <PopoverButton
      :aria-label="isDefined(score) ? 'Edit score' : 'Add score'"
      class="flex cursor-pointer items-center justify-center gap-0.5 outline-none"
      @click="onTriggerClick"
    >
      <template v-if="isDefined(score)">{{ score }}</template>
      <template v-else>
        <mdicon name="plus" />
        <span class="text-xs text-gray-400">/10</span>
      </template>
    </PopoverButton>

    <Teleport to="body">
      <PopoverPanel
        :focus="true"
        class="fixed w-64 rounded-xl border border-slate-600 bg-background p-4 shadow-2xl"
        :style="panelStyle"
      >
        <ScoreEntryPanel
          :work-id="workId"
          :score="score"
          :review-id="reviewId"
          autofocus
          @submit="close()"
          @assist="openAssist(close)"
        />
      </PopoverPanel>
    </Teleport>
  </Popover>

  <!-- Read-only: other members' scores, and every cell in the gallery cards and
       the drawer grid — entry there happens through the drawer's score CTA. -->
  <span v-else-if="isDefined(score)">{{ score }}</span>
</template>

<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/vue";
import { computed, inject } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ScoreAssistKey } from "../scoreAssist";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";
import { useAnchoredPanel } from "@/common/composables/useAnchoredPanel";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
  size?: string;
  // When false (gallery cards, the drawer's member grid), render read-only even
  // for the current user — entry there flows through the drawer's score CTA.
  editable?: boolean;
}>();

const user = useUser();
const isMe = computed(() => user.value?.id === props.memberId);

const canEditInline = computed(() => isMe.value && props.editable !== false);

// A popover isn't an overlay that can swap its content, so the assist flow
// opens in the standalone ScoreAssistModal hosted by ReviewView.
const scoreAssist = inject(ScoreAssistKey, undefined);
const openAssist = (close: () => void) => {
  scoreAssist?.open(props.workId);
  close();
};

const { style: panelStyle, reposition } = useAnchoredPanel({ width: 256 });

const onTriggerClick = (event: MouseEvent) => {
  const button = event.currentTarget;
  if (button instanceof HTMLElement) {
    reposition(button);
  }
};
</script>
