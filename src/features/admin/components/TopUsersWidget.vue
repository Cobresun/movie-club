<template>
  <WidgetShell title="Most active people" subtitle="By activity in the last 30 days">
    <div v-if="users.length > 0" class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" class="py-2 pr-3 font-medium">Person</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Reviews</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Comments</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">List adds</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Total</th>
            <th scope="col" class="py-2 pr-3 text-right font-medium">Clubs</th>
            <th scope="col" class="py-2 text-right font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.userId" class="border-t border-slate-700/40">
            <td class="py-2 pr-3">
              <div class="flex items-center gap-2">
                <img
                  v-if="hasValue(user.image)"
                  :src="user.image"
                  alt=""
                  class="size-6 shrink-0 rounded-full object-cover"
                />
                <span
                  v-else
                  class="flex size-6 shrink-0 items-center justify-center rounded-full bg-background/60 text-xs text-slate-400"
                >
                  {{ initial(user.name) }}
                </span>
                <span class="text-white">{{ user.name }}</span>
              </div>
            </td>
            <td class="py-2 pr-3 text-right text-slate-300">{{ formatCount(user.reviews) }}</td>
            <td class="py-2 pr-3 text-right text-slate-300">{{ formatCount(user.comments) }}</td>
            <td class="py-2 pr-3 text-right text-slate-300">{{ formatCount(user.listAdds) }}</td>
            <td class="py-2 pr-3 text-right font-bold text-white">{{ formatCount(user.total) }}</td>
            <td class="py-2 pr-3 text-right text-slate-400">{{ formatCount(user.clubs) }}</td>
            <td class="py-2 text-right text-slate-400">
              {{ formatRelativeTime(user.lastActive) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="py-8 text-center text-sm text-slate-500">
      Nobody has done anything in the last 30 days.
    </p>

    <p class="mt-4 text-xs text-slate-500">
      Broken down by kind on purpose — forty comments and no reviews is a different person from the
      reverse, and a single total hides that.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { hasValue } from "../../../../lib/checks/checks.js";
import { ActiveUser } from "../../../../lib/types/metrics";
import { formatCount, formatRelativeTime } from "../formatMetrics";
import WidgetShell from "@/common/components/WidgetShell.vue";

defineProps<{
  users: ActiveUser[];
}>();

/** Avatar fallback for users with no image. */
function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase();
}
</script>
