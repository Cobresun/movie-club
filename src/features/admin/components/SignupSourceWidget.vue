<template>
  <WidgetShell title="How people sign in" subtitle="Accounts per auth provider">
    <div v-if="rows.length > 0" class="space-y-3">
      <div v-for="row in rows" :key="row.provider">
        <div class="flex items-baseline justify-between text-sm">
          <span class="text-white">{{ row.label }}</span>
          <span class="text-slate-400">
            {{ formatCount(row.users) }}
            <span class="text-slate-600">({{ row.percent }}%)</span>
          </span>
        </div>
        <!-- A bar chart for three rows would be more chrome than signal; the
             proportion reads fine as an inline meter. -->
        <div class="mt-1 h-2 overflow-hidden rounded-full bg-background/60">
          <div
            class="h-full rounded-full"
            :style="{ width: `${row.percent}%`, backgroundColor: row.color }"
          />
        </div>
      </div>
    </div>
    <p v-else class="py-6 text-center text-sm text-slate-500">No accounts yet.</p>

    <div class="mt-5 rounded-lg bg-background/50 p-3">
      <p class="text-xs uppercase tracking-wide text-slate-400">Unverified emails</p>
      <p class="mt-1 text-xl font-bold" :class="unverifiedTone">
        {{ formatCount(unverifiedUsers) }}
      </p>
      <p class="mt-1 text-xs text-slate-500">
        Signed up but never confirmed their address. Google sign-ins arrive verified, so these are
        password accounts stalled partway through.
      </p>
    </div>

    <p class="mt-4 text-xs text-slate-500">
      Counted per provider, not per person: linking Google to an existing password account creates a
      second record, so these can total more than the user count.
    </p>
  </WidgetShell>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { SignupMethod } from "../../../../lib/types/metrics";
import { formatCount, percentOf } from "../formatMetrics";
import { memberSeriesColor } from "@/common/chartPalette";
import WidgetShell from "@/common/components/WidgetShell.vue";

/** Unverified accounts above this count are worth acting on rather than noting. */
const UNVERIFIED_ALARM = 25;

const props = defineProps<{
  signupMethods: SignupMethod[];
  unverifiedUsers: number;
}>();

/** BetterAuth's internal provider ids, which are not presentable as-is. */
const PROVIDER_LABELS: Record<string, string> = {
  credential: "Email and password",
  google: "Google",
};

const total = computed(() => props.signupMethods.reduce((sum, method) => sum + method.users, 0));

const rows = computed(() =>
  props.signupMethods.map((method, index) => ({
    provider: method.provider,
    label: PROVIDER_LABELS[method.provider] ?? method.provider,
    users: method.users,
    percent: percentOf(method.users, total.value),
    // Identity slots, so a provider keeps one colour as the list reorders.
    color: memberSeriesColor(index),
  })),
);

const unverifiedTone = computed(() =>
  props.unverifiedUsers >= UNVERIFIED_ALARM ? "text-amber-400" : "text-white",
);
</script>
