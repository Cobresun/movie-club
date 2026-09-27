<template>
  <div class="flex flex-1 flex-col justify-center gap-10">
    <section aria-labelledby="wrapped-taste-twins">
      <h3
        id="wrapped-taste-twins"
        class="text-xs font-semibold uppercase tracking-widest text-white/70"
      >
        Taste twins
      </h3>
      <div class="mt-3 flex items-center gap-3">
        <div class="flex shrink-0 gap-1">
          <v-avatar :src="twins.memberA.image" :name="twins.memberA.name" :size="56" />
          <v-avatar :src="twins.memberB.image" :name="twins.memberB.name" :size="56" />
        </div>
        <p class="min-w-0 text-lg font-semibold leading-tight">
          {{ firstName(twins.memberA.name) }} & {{ firstName(twins.memberB.name) }}
        </p>
      </div>
      <p class="mt-3 text-6xl font-bold tabular-nums leading-none">
        {{ Math.round(twins.similarityPercent) }}%
      </p>
      <p class="mt-1 text-sm text-white/80">
        in sync across {{ twins.sharedCount }} {{ countNoun }}
      </p>
    </section>

    <section v-if="isDefined(opposites)" aria-labelledby="wrapped-most-at-odds">
      <h3
        id="wrapped-most-at-odds"
        class="text-xs font-semibold uppercase tracking-widest text-white/70"
      >
        Most at odds
      </h3>
      <div class="mt-3 flex items-center gap-3">
        <div class="flex shrink-0 gap-1">
          <v-avatar :src="opposites.memberA.image" :name="opposites.memberA.name" :size="40" />
          <v-avatar :src="opposites.memberB.image" :name="opposites.memberB.name" :size="40" />
        </div>
        <p class="min-w-0 flex-1 text-base font-semibold leading-tight">
          {{ firstName(opposites.memberA.name) }} & {{ firstName(opposites.memberB.name) }}
        </p>
        <p class="flex shrink-0 flex-col items-end">
          <span class="text-2xl font-bold tabular-nums">
            {{ Math.round(opposites.similarityPercent) }}%
          </span>
          <span class="text-[10px] font-semibold uppercase tracking-widest text-white/60">
            in sync
          </span>
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { isDefined } from "../../../../../lib/checks/checks.js";
import type { MemberPairSimilarity } from "../../../statistics/types";
import { firstName } from "@/common/memberName";

defineProps<{
  twins: MemberPairSimilarity;
  opposites: MemberPairSimilarity | undefined;
  countNoun: string;
}>();
</script>
