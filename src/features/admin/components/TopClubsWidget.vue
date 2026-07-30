<template>
  <WidgetShell title="Busiest clubs" subtitle="By reviews logged, all time">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Club</th>
            <th scope="col" class="py-2 pr-3 font-medium">Type</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Members</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Reviews</th>
            <th scope="col" class="py-2 text-right font-medium">Since</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="club in clubs" :key="club.clubId" class="border-t border-slate-700/40">
            <td class="py-2 pr-3">
              <router-link
                :to="{ name: 'ClubHome', params: { clubSlug: club.slug } }"
                class="text-primary hover:underline"
              >
                {{ club.name }}
              </router-link>
            </td>
            <td class="py-2 pr-3 text-slate-400">{{ club.type }}</td>
            <td class="py-2 pr-3 text-right text-white">{{ formatCount(club.memberCount) }}</td>
            <td class="py-2 pr-3 text-right text-white">{{ formatCount(club.reviewCount) }}</td>
            <td class="py-2 text-right text-slate-400">
              <span v-if="hasValue(club.createdAt)">{{ club.createdAt }}</span>
              <span v-else class="text-slate-600" title="No activity to date this club from">
                unknown
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </WidgetShell>
</template>

<script setup lang="ts">
import { hasValue } from "../../../../lib/checks/checks.js";
import { TopClub } from "../../../../lib/types/metrics";
import { formatCount } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

defineProps<{
  clubs: TopClub[];
}>();
</script>
