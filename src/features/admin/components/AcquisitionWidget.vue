<template>
  <WidgetShell
    title="Acquisition"
    :subtitle="`Where people who signed up ${rangeWithin(range)} came from`"
    outer-class="w-full"
  >
    <template #controls>
      <SegmentedToggle v-model="board" :options="BOARD_OPTIONS" />
    </template>

    <ul v-if="rows.length > 0" :aria-label="boardLabel" class="divide-y divide-slate-700/40">
      <li v-for="row in rows" :key="row.key" class="flex items-center gap-3 py-2.5">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-white">{{ row.label }}</p>
          <p class="truncate text-xs text-slate-400">{{ row.description }}</p>
        </div>
        <p class="shrink-0 text-right">
          <span class="text-sm font-semibold text-white tabular-nums">
            {{ pluralize(row.signups, "signup") }}
          </span>
          <span class="block text-xs text-slate-500">
            {{
              row.signups > 0
                ? `${percentOf(row.activated, row.signups)}% activated (${formatCount(row.activated)})`
                : "—"
            }}
          </span>
        </p>
      </li>
    </ul>
    <p v-else class="py-10 text-center text-sm text-slate-500">
      <template v-if="board === 'campaigns'">
        No signups from tagged links {{ rangeWithin(range) }}. Add <code>utm_source</code> and
        <code>utm_campaign</code> to an ad or post link to see it here.
      </template>
      <template v-else>
        No signups from a named referrer {{ rangeWithin(range) }}. Tag a link with
        <code>?ref=</code> to see it here.
      </template>
    </p>

    <p class="mt-3 text-xs text-slate-500">
      Credited to the last visit that came through a link. Activated means the account has since
      reviewed, commented, or added to a list.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { SignupSource } from "../../../../lib/types/generated/db";
import { Acquisition, MetricsRange } from "../../../../lib/types/metrics";
import { formatCount, percentOf, pluralize } from "../formatMetrics";
import { rangeWithin } from "../ranges";
import WidgetShell from "@/common/components/WidgetShell.vue";
import SegmentedToggle from "@/features/statistics/components/SegmentedToggle.vue";

const BOARD_OPTIONS = [
  { value: "channels", label: "Channels" },
  { value: "referrers", label: "Referrers" },
  { value: "campaigns", label: "Campaigns" },
] as const;

const props = defineProps<{
  acquisition: Acquisition;
  range: MetricsRange;
}>();

const board = ref<Board>("channels");

const CHANNELS: Record<SignupSource, { label: string; description: string }> = {
  [SignupSource.INVITE]: {
    label: "Club invite",
    description: "Opened a club's invite link",
  },
  [SignupSource.SHARE]: {
    label: "Shared page",
    description: "A shared review, list, or statistics page",
  },
  [SignupSource.REFERRAL]: {
    label: "Referral",
    description: "Another site, or a link tagged with ?ref= or utm_source",
  },
  [SignupSource.DIRECT]: {
    label: "Direct",
    description: "Typed in, bookmarked, or no referrer",
  },
};

const NOT_RECORDED = {
  label: "Not recorded",
  description: "Signed up before tracking began, or cookies blocked",
};

interface Row {
  key: string;
  label: string;
  description: string;
  signups: number;
  activated: number;
}

type Board = (typeof BOARD_OPTIONS)[number]["value"];

const ROWS: Record<Board, (acquisition: Acquisition) => Row[]> = {
  channels: ({ channels }) =>
    channels.map((channel) => ({
      ...channel,
      ...(channel.source === null ? NOT_RECORDED : CHANNELS[channel.source]),
      key: channel.source ?? "not-recorded",
    })),
  referrers: ({ referrers }) =>
    referrers.map((referrer) => ({
      ...referrer,
      key: referrer.referrer,
      label: referrer.referrer,
      description: "Referral tag or referring site",
    })),
  campaigns: ({ campaigns }) =>
    campaigns.map((campaign) => ({
      ...campaign,
      key: `${campaign.utmSource}~${campaign.utmCampaign ?? ""}`,
      label: campaign.utmSource,
      description: campaign.utmCampaign ?? "No campaign",
    })),
};

const rows = computed(() => ROWS[board.value](props.acquisition));

const boardLabel = computed(
  () => BOARD_OPTIONS.find((option) => option.value === board.value)?.label,
);
</script>
