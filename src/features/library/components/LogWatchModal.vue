<template>
  <v-modal @close="emit('close')">
    <div class="flex h-full flex-col gap-4 text-left">
      <!-- Search step: pick the work (create flow only) -->
      <template v-if="step === 'search'">
        <h2 class="text-center text-xl font-bold">Log a watch</h2>
        <div class="flex justify-center gap-2">
          <button
            v-for="type in workTypes"
            :key="type"
            class="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors"
            :class="
              selectedWorkType === type
                ? 'bg-primary text-white'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            "
            @click="selectedWorkType = type"
          >
            <mdicon :name="workTypeIcon(type)" :size="16" />
            {{ workTypeLabel(type) }}
          </button>
        </div>
        <WorkSearchPrompt
          class="min-h-0 flex-1"
          :club-type="selectedClubType"
          :default-list="[]"
          default-list-title=""
          @select-from-default="onSelectWork"
          @select-from-search="onSelectWork"
        />
      </template>

      <!-- Details step: score, date, rewatch, text -->
      <template v-else>
        <button
          v-if="!isEdit"
          class="self-start text-sm text-gray-400 hover:text-white"
          @click="step = 'search'"
        >
          ‹ Back to search
        </button>
        <h2 class="text-center text-xl font-bold">
          {{ selectedWork?.title }}
        </h2>

        <div class="flex flex-col items-center gap-2">
          <ScoreDial v-if="!unrated" v-model="scoreModel" @save="submit" />
          <p v-else class="py-6 text-gray-400">Logging without a score</p>
          <label class="flex items-center gap-2 text-sm text-gray-300">
            <input v-model="unrated" type="checkbox" />
            Log without a score
          </label>
        </div>

        <label class="flex flex-col gap-1 text-sm text-gray-300">
          Watched date
          <input
            v-model="watchedDate"
            type="date"
            class="rounded-md border-2 border-gray-600 bg-transparent p-1 text-base text-white outline-none focus:border-primary"
          />
        </label>

        <label class="flex items-center gap-2 text-sm text-gray-300">
          <input v-model="rewatch" type="checkbox" />
          This was a rewatch
        </label>

        <label class="flex flex-col gap-1 text-sm text-gray-300">
          Your review
          <textarea
            v-model="text"
            rows="3"
            placeholder="Write a review (optional)"
            class="rounded-md border-2 border-gray-600 bg-transparent p-2 text-base text-white outline-none focus:border-primary"
          />
        </label>

        <v-btn class="self-center" @click="submit">
          {{ isEdit ? "Save changes" : "Log watch" }}
        </v-btn>
      </template>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DiaryEntry } from "../../../../lib/types/me";
import ScoreDial from "../../reviews/components/ScoreDial.vue";
import { clampScore, isValidScore } from "../../reviews/scoreScale";

import {
  clubTypeForWork,
  workTypeIcon,
  workTypeLabel,
} from "@/common/clubType";
import WorkSearchPrompt from "@/common/components/WorkSearchPrompt.vue";
import { useEditSoloReview, useLogWatch } from "@/service/useLibrary";
import { WorkSearchResult } from "@/service/useMediaSearch";

interface LogWatchWork {
  type: WorkType;
  title: string;
  externalId?: string;
  imageUrl?: string;
}

// When editing, the modal opens straight to the details form pre-filled from
// the existing solo event; when logging fresh it starts on the search step.
const { editEntry } = defineProps<{ editEntry?: DiaryEntry }>();

const emit = defineEmits<{ (e: "close"): void }>();

const isEdit = isDefined(editEntry);
const workTypes = [WorkType.movie, WorkType.book];

const selectedWorkType = ref<WorkType>(editEntry?.work.type ?? WorkType.movie);
const selectedClubType = computed(() =>
  clubTypeForWork(selectedWorkType.value),
);

const selectedWork = ref<LogWatchWork | undefined>(
  isDefined(editEntry)
    ? {
        type: editEntry.work.type,
        title: editEntry.work.title,
        externalId: editEntry.work.externalId ?? undefined,
        imageUrl: editEntry.work.imageUrl ?? undefined,
      }
    : undefined,
);

const step = ref<"search" | "details">(isEdit ? "details" : "search");

// The dial's draft stays a string; empty means no score typed. The explicit
// "unrated" toggle is the deliberate no-score state (a real feature), seeded on
// for an edit of an event that was already unrated.
const scoreModel = ref(
  isDefined(editEntry?.score) ? String(editEntry.score) : "",
);
const unrated = ref(isDefined(editEntry) && editEntry.score === null);
const watchedDate = ref(editEntry?.watchedDate ?? "");
const rewatch = ref(editEntry?.rewatch ?? false);
const text = ref(editEntry?.text ?? "");

const onSelectWork = (work: WorkSearchResult) => {
  selectedWork.value = {
    type: selectedWorkType.value,
    title: work.title,
    externalId: work.externalId,
    imageUrl: work.imageUrl,
  };
  step.value = "details";
};

const resolvedScore = (): number | null => {
  if (unrated.value) return null;
  const parsed = Number.parseFloat(scoreModel.value);
  return isValidScore(parsed)
    ? clampScore(Math.round(parsed * 100) / 100)
    : null;
};

const { mutate: logWatch } = useLogWatch();
const { mutate: editReview } = useEditSoloReview();

const submit = () => {
  const work = selectedWork.value;
  if (!isDefined(work)) return;
  const score = resolvedScore();

  if (isDefined(editEntry)) {
    editReview({
      reviewId: editEntry.reviewId,
      patch: {
        score,
        watchedDate: hasValue(watchedDate.value) ? watchedDate.value : null,
        rewatch: rewatch.value,
        text: hasValue(text.value) ? text.value : null,
      },
    });
  } else {
    logWatch({
      work: {
        type: work.type,
        title: work.title,
        externalId: work.externalId,
        imageUrl: work.imageUrl,
      },
      score,
      rewatch: rewatch.value,
      ...(hasValue(watchedDate.value)
        ? { watchedDate: watchedDate.value }
        : {}),
      ...(hasValue(text.value) ? { text: text.value } : {}),
    });
  }
  emit("close");
};
</script>
