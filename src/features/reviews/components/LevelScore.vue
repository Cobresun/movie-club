<template>
  <div role="group" :aria-label="label" class="px-3 py-3 md:pl-11 md:pr-3">
    <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div class="flex items-end gap-6">
        <div v-if="showClub" class="flex flex-col-reverse">
          <span class="text-[11px] text-white/55">Club</span>
          <span
            class="text-2xl font-bold leading-tight"
            :class="[
              isDefined(level.scores.average) ? 'text-primary' : 'text-gray-500',
              revealed || !isDefined(level.scores.average) ? '' : 'blur filter',
            ]"
            :aria-hidden="!revealed || undefined"
          >
            {{ formatRollup(level.scores) }}
          </span>
        </div>
        <div v-if="isDefined(own)" class="flex flex-col-reverse">
          <span class="text-[11px] text-white/55">
            {{ own.averaged ? `You · from your ${below}` : "You" }}
          </span>
          <span class="flex items-center text-2xl font-bold leading-tight">
            <mdicon
              v-if="own.averaged"
              name="approximately-equal"
              :size="20"
              class="text-gray-400"
              aria-hidden="true"
            />
            {{ own.value }}
          </span>
        </div>
      </div>

      <ScoreChips
        v-if="isDesktop && chipsOnDesktop && memberEntries.length > 0"
        class="flex-grow justify-end"
        row
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <!-- On a phone the members' scores take their own line, between the
           numbers above and the actions below. -->
      <ScoreChips
        v-if="!isDesktop && memberEntries.length > 0"
        class="w-full"
        row
        show-names
        :entries="memberEntries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <ScoreActions
        class="md:ml-auto"
        :noun="noun"
        :has-own-score="isDefined(target.reviewId)"
        :can-score="isDefined(currentUserId)"
        :can-reveal="!revealed && entries.some((entry) => isOthersScore(entry, currentUserId))"
        @score="scoring = true"
        @reveal="emit('reveal')"
        @details="emit('details')"
      />
    </div>

    <Teleport to="body">
      <ScoreEntryModal
        v-if="scoring"
        :target="target.work"
        :score="target.score"
        :review-id="target.reviewId"
        :save-score="target.saveScore"
        @close="scoring = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { ScoreTarget } from "../episodeCards";
import { isOthersScore, ScoreEntry } from "../reviewScores";
import { formatRollup, LevelScores, ownLevelScore } from "../reviewTree";
import ScoreActions from "./ScoreActions.vue";
import ScoreChips from "./ScoreChips.vue";
import ScoreEntryModal from "./ScoreEntryModal.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";

const props = defineProps<{
  /** "Show score" or "Season score" — the group's accessible name. */
  label: string;
  /** "show" or "season" — what the score button names. */
  noun: string;
  /** What a member's score here averages when they have not set one. */
  below: "seasons" | "episodes";
  level: LevelScores;
  entries: ScoreEntry[];
  revealed: boolean;
  target: ScoreTarget;
  currentUserId?: string;
  /** Shown where the header above does not already carry the club's number. */
  showClub?: boolean;
  /** Shown on desktop where the header above does not already list them. */
  chipsOnDesktop?: boolean;
}>();

const emit = defineEmits<{
  (e: "reveal"): void;
  (e: "details"): void;
}>();

const isDesktop = useIsDesktop();

const scoring = ref(false);

const own = computed(() => ownLevelScore(props.level, props.currentUserId));
const memberEntries = computed(() => props.entries.filter((entry) => isDefined(entry.memberId)));
</script>
