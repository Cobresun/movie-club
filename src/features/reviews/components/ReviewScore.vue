<template>
  <!-- Editable inline (reviews table): the score / "+" is a popover trigger that
       opens the shared score-entry panel. -->
  <Popover
    v-if="canEditInline"
    v-slot="{ close }"
    as="span"
    class="inline-flex"
  >
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
        />
      </PopoverPanel>
    </Teleport>
  </Popover>

  <!-- Small poster chips (gallery): defer to the roomier details drawer instead
       of opening a cramped popover on the poster. -->
  <span
    v-else-if="deferToDrawer"
    role="button"
    :aria-label="isDefined(score) ? 'Edit score' : 'Add score'"
    class="flex cursor-pointer items-center justify-center gap-0.5"
    @click.stop="requestScoreEntry?.(workId)"
  >
    <template v-if="isDefined(score)">{{ score }}</template>
    <mdicon v-else name="plus" />
  </span>

  <!-- Read-only: other members' scores, and every cell inside the drawer table
       (entry there happens through the dedicated ScoreEntryPanel). -->
  <span v-else-if="isDefined(score)">{{ score }}</span>
</template>

<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/vue";
import { computed, inject } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { RequestScoreEntryKey } from "../scoreEntry";
import ScoreEntryPanel from "./ScoreEntryPanel.vue";

import { useAnchoredPanel } from "@/common/composables/useAnchoredPanel";
import { useUser } from "@/service/useUser";

const props = defineProps<{
  memberId: string;
  workId: string;
  score?: number;
  reviewId?: string;
  size?: string;
  // When true (poster chips in the gallery), clicking defers score entry to the
  // details drawer instead of opening a cramped inline popover on the poster.
  openInDrawer?: boolean;
  // When false (the drawer's member table), render read-only even for the
  // current user — entry there flows through the drawer's ScoreEntryPanel.
  editable?: boolean;
}>();

const user = useUser();
const isMe = computed(() => user.value?.id === props.memberId);
const isEditable = computed(() => props.editable !== false);

const canEditInline = computed(
  () => isMe.value && isEditable.value && props.openInDrawer !== true,
);
const deferToDrawer = computed(
  () => isMe.value && isEditable.value && props.openInDrawer === true,
);

const requestScoreEntry = inject(RequestScoreEntryKey, undefined);

const { style: panelStyle, reposition } = useAnchoredPanel({ width: 256 });

const onTriggerClick = (event: MouseEvent) => {
  const button = event.currentTarget;
  if (button instanceof HTMLElement) {
    reposition(button);
  }
};
</script>
