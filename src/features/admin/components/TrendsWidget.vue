<template>
  <WidgetShell title="Trends" outer-class="w-full">
    <template #controls>
      <SegmentedToggle v-model="view" :options="VIEW_OPTIONS" />
    </template>

    <template v-if="view === 'activity'">
      <p class="mb-3 text-sm text-slate-400">
        <span class="font-semibold text-white">{{ pluralize(totals.reviews, "review") }}</span>
        · {{ pluralize(totals.comments, "comment") }} ·
        {{ pluralize(totals.listAdds, "list add") }}
        {{ rangeWithin(range) }}
      </p>
      <VChart v-if="hasActivity" :options="activityOptions" />
      <p v-else class="py-10 text-center text-sm text-slate-500">
        Nothing was reviewed, discussed, or added {{ rangeWithin(range) }}.
      </p>
    </template>

    <template v-else>
      <p class="mb-3 text-sm text-slate-400">
        Each point counts the 30 days up to that day, from the daily snapshot.
      </p>
      <VChart v-if="snapshots.length > 1" :options="activesOptions" />
      <p v-else class="py-10 text-center text-sm text-slate-500">
        {{
          snapshots.length === 0
            ? "No snapshots in this range yet."
            : "Only one snapshot so far — a trend needs at least two days."
        }}
      </p>
    </template>
  </WidgetShell>
</template>

<script setup lang="ts">
import type { AgCartesianChartOptions } from "ag-charts-community";
import { computed, ref } from "vue";

import {
  ActivityBucket,
  BucketUnit,
  MetricsRange,
  SnapshotHistoryPoint,
} from "../../../../lib/types/metrics";
import { formatBucket, integerTickStep, pluralize, thinLabels } from "../formatMetrics";
import { rangeWithin } from "../ranges";
import {
  axisLabelFontSize,
  baseChartOptions,
  baseLegendOptions,
  CHART_SURFACE,
  MEMBER_SERIES_COLORS,
} from "@/common/chartPalette";
import VChart from "@/common/components/VChart.vue";
import WidgetShell from "@/common/components/WidgetShell.vue";
import { useIsDesktop } from "@/common/composables/useIsDesktop";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const VIEW_OPTIONS = [
  { value: "activity", label: "Activity" },
  { value: "actives", label: "Monthly actives" },
] as const;

const LABEL_TARGET_COMPACT = 5;
const LABEL_TARGET_WIDE = 10;

const props = defineProps<{
  range: MetricsRange;
  unit: BucketUnit;
  buckets: ActivityBucket[];
  snapshots: SnapshotHistoryPoint[];
}>();

const view = ref<(typeof VIEW_OPTIONS)[number]["value"]>("activity");

const isDesktop = useIsDesktop();
const compact = computed(() => !isDesktop.value);

const totals = computed(() =>
  props.buckets.reduce(
    (sum, bucket) => ({
      reviews: sum.reviews + bucket.reviews,
      comments: sum.comments + bucket.comments,
      listAdds: sum.listAdds + bucket.listAdds,
    }),
    { reviews: 0, comments: 0, listAdds: 0 },
  ),
);

const hasActivity = computed(
  () => totals.value.reviews + totals.value.comments + totals.value.listAdds > 0,
);

// Identity slots in fixed order, so a series keeps its colour across both views.
const [reviewsColor, commentsColor, listAddsColor] = MEMBER_SERIES_COLORS;

// Extra right padding so the last date label, which is always drawn, isn't
// clipped by the chart's edge.
const chartFrame = computed(() => {
  const base = baseChartOptions(compact.value);
  return { ...base, padding: { ...base.padding, right: compact.value ? 20 : 24 } };
});

function categoryAxis(count: number, format: (value: string) => string) {
  const showLabel = thinLabels(count, compact.value ? LABEL_TARGET_COMPACT : LABEL_TARGET_WIDE);
  return {
    type: "category" as const,
    position: "bottom" as const,
    label: {
      fontSize: axisLabelFontSize(compact.value),
      // Every category keeps its tick; the thinned ones just carry no text.
      // ag-charts draws all categories on a category axis, so the formatter
      // is the only lever.
      formatter: ({ value, index }: { value: string; index: number }) =>
        showLabel(index) ? format(value) : "",
    },
  };
}

function countAxis(max: number) {
  return {
    type: "number" as const,
    position: "left" as const,
    // Whole events only — see integerTickStep.
    interval: { step: integerTickStep(max) },
    label: { fontSize: axisLabelFontSize(compact.value) },
  };
}

// Stacked on one axis: the three kinds are the same unit (something a person
// did), so the bar's height reads as total activity and the segments as its mix.
const activityOptions = computed<AgCartesianChartOptions>(() => {
  const stackMax = Math.max(
    0,
    ...props.buckets.map((bucket) => bucket.reviews + bucket.comments + bucket.listAdds),
  );
  const bar = (yKey: keyof ActivityBucket, yName: string, fill: string) => ({
    type: "bar" as const,
    xKey: "bucket",
    yKey,
    yName,
    fill,
    stacked: true,
    // A surface-coloured seam keeps touching segments separable.
    stroke: CHART_SURFACE,
    strokeWidth: 1,
    cornerRadius: 2,
  });

  return {
    ...chartFrame.value,
    data: props.buckets,
    series: [
      bar("reviews", "Reviews", reviewsColor),
      bar("comments", "Comments", commentsColor),
      bar("listAdds", "List adds", listAddsColor),
    ],
    legend: baseLegendOptions(compact.value),
    axes: [
      categoryAxis(props.buckets.length, (value) => formatBucket(value, props.unit)),
      countAxis(stackMax),
    ],
  };
});

const actives = computed(() =>
  props.snapshots.map((point) => ({
    date: point.capturedOn,
    engaged: point.metrics.engagedUsers.last30Days,
    signedIn: point.metrics.loggedInUsers.last30Days,
    clubs: point.metrics.activeClubs.last30Days,
  })),
);

const activesOptions = computed<AgCartesianChartOptions>(() => {
  const max = Math.max(
    0,
    ...actives.value.flatMap((point) => [point.engaged, point.signedIn, point.clubs]),
  );
  const line = (yKey: string, yName: string, stroke: string) => ({
    type: "line" as const,
    xKey: "date",
    yKey,
    yName,
    stroke,
    strokeWidth: 2,
    marker: { enabled: false },
  });

  return {
    ...chartFrame.value,
    data: actives.value,
    series: [
      line("signedIn", "Signed in", listAddsColor),
      line("engaged", "Contributed", reviewsColor),
      line("clubs", "Active clubs", commentsColor),
    ],
    legend: baseLegendOptions(compact.value),
    axes: [
      categoryAxis(actives.value.length, (value) => formatBucket(value, "day")),
      countAxis(max),
    ],
  };
});
</script>
