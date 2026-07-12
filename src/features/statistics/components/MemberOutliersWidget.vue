<template>
  <WidgetShell
    v-if="hasData"
    :title="config.title"
    :subtitle="config.subtitle(workNoun)"
  >
    <template #controls>
      <SegmentedToggle v-model="mode" :options="modeOptions" />
    </template>

    <MemberFilterChips
      v-model="selectedMemberId"
      :members="entryMembers"
      :include-all="false"
      class="mb-4"
    />

    <div v-if="selectedEntry" class="space-y-1.5">
      <div
        v-for="work in selectedEntry.movies"
        :key="work.title"
        class="flex items-center gap-3 rounded-lg border border-slate-700/30 bg-background/50 px-3 py-2"
      >
        <img
          v-if="work.imageUrl"
          :src="work.imageUrl"
          :alt="work.title"
          class="h-12 w-8 shrink-0 rounded object-cover"
        />
        <div
          v-else
          class="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-slate-700/50 text-xs text-slate-500"
        >
          ?
        </div>
        <div class="min-w-0 flex-1 text-left">
          <p
            class="w-fit max-w-full truncate text-sm font-medium text-white"
            :title="work.title"
          >
            {{ work.title }}
          </p>
          <p class="text-xs text-slate-400">
            Club avg: {{ work.clubAverage.toFixed(1) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <span
            class="rounded-full px-2.5 py-1 text-sm font-bold"
            :class="config.scoreChipClass"
          >
            {{ work.memberScore.toFixed(1) }}
          </span>
          <p class="mt-0.5 text-xs" :class="config.deltaClass">
            {{ work.difference > 0 ? "+" : "" }}{{ work.difference.toFixed(1) }}
          </p>
        </div>
      </div>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import MemberFilterChips from "./MemberFilterChips.vue";
import SegmentedToggle from "./SegmentedToggle.vue";
import WidgetShell from "./WidgetShell.vue";
import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import {
  computeClubCurmudgeons,
  computeGuiltyPleasures,
} from "../statsComputers";
import type { WorkStatsData } from "../types";

import { clubTypeStats } from "@/common/clubType";

type Mode = "guilty" | "curmudgeon";

/**
 * The two flavors of "one member against the room": loved it alone (emerald,
 * above average) and hated it alone (rose, below average).
 */
const MODE_CONFIG: Record<
  Mode,
  {
    label: string;
    title: string;
    subtitle: (workNoun: string) => string;
    scoreChipClass: string;
    deltaClass: string;
  }
> = {
  guilty: {
    label: "Guilty Pleasures",
    title: "Guilty Pleasures",
    subtitle: (workNoun) =>
      `${workNoun} where only one member loved it (2+ points above club average)`,
    scoreChipClass: "bg-emerald-900/30 text-emerald-400",
    deltaClass: "text-emerald-400/70",
  },
  curmudgeon: {
    label: "Curmudgeons",
    title: "Club Curmudgeons",
    subtitle: (workNoun) =>
      `${workNoun} where only one member hated it (2+ points below club average)`,
    scoreChipClass: "bg-rose-900/30 text-rose-400",
    deltaClass: "text-rose-400/70",
  },
};

const props = defineProps<{
  workData: WorkStatsData[];
  members: Member[];
  clubType: ClubType;
}>();

const workNoun = computed(() => clubTypeStats(props.clubType).pluralNoun);

const guiltyEntries = computed(() =>
  computeGuiltyPleasures(props.workData, props.members),
);
const curmudgeonEntries = computed(() =>
  computeClubCurmudgeons(props.workData, props.members),
);

const modeOptions = computed(() => {
  const options: { value: Mode; label: string }[] = [];
  if (guiltyEntries.value.length > 0) {
    options.push({ value: "guilty", label: MODE_CONFIG.guilty.label });
  }
  if (curmudgeonEntries.value.length > 0) {
    options.push({ value: "curmudgeon", label: MODE_CONFIG.curmudgeon.label });
  }
  return options;
});

const hasData = computed(() => modeOptions.value.length > 0);

// Fall back to the first tab with data rather than watching for changes
// (see code-quality.md on avoiding watch()).
const selectedMode = ref<Mode>("guilty");
const mode = computed<Mode>({
  get: () =>
    modeOptions.value.some((option) => option.value === selectedMode.value)
      ? selectedMode.value
      : (modeOptions.value[0]?.value ?? "guilty"),
  set: (value) => {
    selectedMode.value = value;
  },
});

const config = computed(() => MODE_CONFIG[mode.value]);

const entries = computed(() =>
  mode.value === "guilty" ? guiltyEntries.value : curmudgeonEntries.value,
);

const entryMembers = computed(() => entries.value.map((entry) => entry.member));

// Same fallback pattern for the member chips: keep the pick when it still has
// entries in the current mode, otherwise land on the first member.
const pickedMemberId = ref<string | undefined>(undefined);
const selectedMemberId = computed<string | undefined>({
  get: () =>
    entries.value.some((entry) => entry.member.id === pickedMemberId.value)
      ? pickedMemberId.value
      : entries.value[0]?.member.id,
  set: (value) => {
    pickedMemberId.value = value;
  },
});

const selectedEntry = computed(() =>
  entries.value.find((entry) => entry.member.id === selectedMemberId.value),
);
</script>
