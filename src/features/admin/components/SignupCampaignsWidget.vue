<template>
  <WidgetShell title="Campaigns" subtitle="Signups from links tagged with utm_source">
    <div v-if="signupCampaigns.length > 0" class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Source / campaign</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Last 30 days</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">All time</th>
            <th scope="col" class="py-2 text-right font-medium">Activated</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in signupCampaigns"
            :key="`${row.utmSource}~${row.utmCampaign ?? ''}`"
            class="border-t border-slate-700/40"
          >
            <th scope="row" class="py-2 pr-3 font-normal">
              <span class="text-white">{{ row.utmSource }}</span>
              <span class="block text-xs text-slate-500">{{
                row.utmCampaign ?? "No campaign"
              }}</span>
            </th>
            <td class="py-2 pr-3 text-right font-bold text-white">
              {{ formatCount(row.last30Days) }}
            </td>
            <td class="py-2 pr-3 text-right text-slate-300">{{ formatCount(row.users) }}</td>
            <td class="py-2 text-right text-slate-300">
              {{ percentOf(row.activated, row.users) }}%
              <span class="text-xs text-slate-500">({{ formatCount(row.activated) }})</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-sm text-slate-400">
      No signups from tagged links yet. Add <code>utm_source</code> and <code>utm_campaign</code> to
      an ad or post link to see it here.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { SignupCampaignCount } from "../../../../lib/types/metrics";
import { formatCount, percentOf } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

defineProps<{
  signupCampaigns: SignupCampaignCount[];
}>();
</script>
