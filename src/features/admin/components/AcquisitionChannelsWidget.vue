<template>
  <WidgetShell title="Where signups come from" subtitle="New accounts by how they first arrived">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Channel</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Last 30 days</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">All time</th>
            <th scope="col" class="py-2 text-right font-medium">Activated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-t border-slate-700/40">
            <th scope="row" class="py-2 pr-3 font-normal">
              <span class="text-white">{{ row.label }}</span>
              <span class="block text-xs text-slate-500">{{ row.description }}</span>
            </th>
            <td class="py-2 pr-3 text-right font-bold text-white">
              {{ formatCount(row.last30Days) }}
            </td>
            <td class="py-2 pr-3 text-right text-slate-300">{{ formatCount(row.users) }}</td>
            <td class="py-2 text-right text-slate-300">
              <template v-if="row.users > 0">
                {{ percentOf(row.activated, row.users) }}%
                <span class="text-xs text-slate-500">({{ formatCount(row.activated) }})</span>
              </template>
              <span v-else class="text-slate-600">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-4 text-xs text-slate-500">
      Credited to the last visit that came through a link, so typing the address in afterwards
      doesn't erase an invite. Activated means the account has since reviewed, commented, or added
      to a list.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { SignupSource } from "../../../../lib/types/generated/db";
import { SignupSourceCount } from "../../../../lib/types/metrics";
import { formatCount, percentOf } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

const props = defineProps<{
  signupSources: SignupSourceCount[];
}>();

const CHANNELS: Record<SignupSource, { label: string; description: string }> = {
  [SignupSource.invite]: {
    label: "Club invite",
    description: "Opened a club's invite link",
  },
  [SignupSource.share]: {
    label: "Shared page",
    description: "A shared review, list, or statistics page",
  },
  [SignupSource.referral]: {
    label: "Referral",
    description: "Another site, or a link tagged with ?ref=",
  },
  [SignupSource.direct]: {
    label: "Direct",
    description: "Typed in, bookmarked, or no referrer",
  },
};

const NOT_RECORDED = {
  label: "Not recorded",
  description: "Signed up before tracking began, or cookies blocked",
};

const rows = computed(() =>
  props.signupSources.map((count) => ({
    ...count,
    ...(count.source === null ? NOT_RECORDED : CHANNELS[count.source]),
    key: count.source ?? "not-recorded",
  })),
);
</script>
