<template>
  <div
    class="flex h-full w-full flex-col rounded-lg bg-slate-700"
    :class="card.aired ? '' : 'opacity-60'"
  >
    <!-- The still opens the episode, the way a poster opens a movie; the
         title is its accessible name, so the code badge is left out of it. -->
    <button
      type="button"
      class="relative block w-full rounded-t-lg"
      :aria-label="card.title"
      :disabled="!card.aired"
      @click="emit('select')"
    >
      <img
        v-if="hasValue(card.stillUrl)"
        v-lazy-load
        :src="card.stillUrl"
        alt=""
        class="aspect-video w-full rounded-t-lg object-cover"
      />
      <div
        v-else
        class="flex aspect-video w-full items-center justify-center rounded-t-lg bg-background"
      >
        <mdicon name="television-classic" class="text-slate-500" />
      </div>
      <span
        class="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 text-xs font-semibold"
        aria-hidden="true"
      >
        {{ card.code }}
      </span>
    </button>

    <div class="flex flex-grow flex-col px-2 pb-2">
      <div class="my-2 flex flex-grow items-center justify-center">
        <h3 class="font-semibold">{{ card.title }}</h3>
      </div>
      <div v-if="pending" class="mb-2 text-sm text-gray-400" role="status">Saving…</div>
      <div v-else-if="isDefined(card.node)" class="mb-2 text-sm text-gray-400">
        {{ formatCardDate(card.node.review.createdDate) }}
      </div>
      <div v-else-if="!card.aired" class="text-sm text-gray-400">Upcoming</div>

      <ScoreChips
        v-if="entries.length > 0"
        :entries="entries"
        :current-user-id="currentUserId"
        :revealed="revealed"
      />
      <button
        v-if="canScore"
        type="button"
        class="flex w-full items-center justify-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary ring-1 ring-inset ring-primary/20 transition duration-fast ease-standard hover:bg-primary/20 active:scale-[0.98]"
        :class="entries.length > 0 ? 'mt-2' : ''"
        :aria-label="`Score ${card.title}`"
        @click="emit('select')"
      >
        <mdicon name="plus" :size="16" />
        Score
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { EpisodeCard } from "../episodeCards";
import { ScoreEntry } from "../reviewScores";
import ScoreChips from "./ScoreChips.vue";
import { formatCardDate } from "@/common/workDisplay";

defineProps<{
  card: EpisodeCard;
  entries: ScoreEntry[];
  revealed: boolean;
  canScore: boolean;
  pending: boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "select"): void;
}>();
</script>
