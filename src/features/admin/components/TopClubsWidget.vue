<template>
  <WidgetShell title="Busiest clubs" subtitle="By reviews logged, all time">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Club</th>
            <th scope="col" class="py-2 pr-3 font-medium">Members</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Reviews</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Last review</th>
            <th scope="col" class="py-2 text-right font-medium">Since</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="club in clubs" :key="club.clubId" class="border-t border-slate-700/40">
            <td class="py-2 pr-3">
              <!-- The club type rides alongside the name rather than holding a
                   column of its own: one 16px glyph per row didn't earn the
                   width, and it reads as an attribute of the club anyway. -->
              <span class="flex items-center gap-2">
                <mdicon
                  :name="clubTypeIcon(club.type)"
                  size="16"
                  class="shrink-0 text-slate-500"
                  :title="clubTypeLabel(club.type)"
                />
                <router-link
                  :to="{ name: 'ClubHome', params: { clubSlug: club.slug } }"
                  class="text-primary hover:underline"
                >
                  {{ club.name }}
                </router-link>
                <span class="sr-only">{{ clubTypeLabel(club.type) }}</span>
              </span>
            </td>
            <td class="py-2 pr-3">
              <span class="text-white">{{ formatCount(club.memberCount) }}</span>
              <span v-if="club.memberNames.length > 0" class="ml-2 text-xs text-slate-400">
                {{ memberSummary(club.memberNames) }}
              </span>
            </td>
            <td class="py-2 pr-3 text-right text-white">{{ formatCount(club.reviewCount) }}</td>
            <td class="py-2 pr-3 text-right text-slate-400">
              <span v-if="hasValue(club.lastReviewAt)">{{ club.lastReviewAt }}</span>
              <span v-else class="text-slate-600" title="This club has never logged a review">
                never
              </span>
            </td>
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
// Club type reaches the template through the registry rather than as the raw
// enum value: the column previously rendered the literal string "movie".
// Registry icons are invisible to icons.test.ts's static scan — these two are
// already covered by its CLUB_TYPE_CONFIG check.
import { clubTypeIcon, clubTypeLabel } from "@/common/clubType";
import WidgetShell from "@/common/components/WidgetShell.vue";

/** Names shown inline before the rest collapse into a "+N" tail. */
const MAX_NAMES = 3;

defineProps<{
  clubs: TopClub[];
}>();

/**
 * Member names, truncated so a large club can't blow out the row.
 *
 * The names are the point — a count of four says nothing about whether it's
 * four strangers or four people you know — but the full list of a seven-person
 * club would wrap the row, so the tail becomes a count.
 */
function memberSummary(names: string[]): string {
  if (names.length <= MAX_NAMES) {
    return names.join(", ");
  }
  return `${names.slice(0, MAX_NAMES).join(", ")} +${names.length - MAX_NAMES}`;
}
</script>
