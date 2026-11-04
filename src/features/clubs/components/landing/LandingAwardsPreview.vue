<template>
  <section
    aria-labelledby="landing-awards-heading"
    class="bg-background flex flex-col gap-6 rounded-2xl border border-white/10 p-5 text-left sm:p-6"
  >
    <AwardsStepper :step="AwardsStep.Presentation" />
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="landing-awards-heading" class="text-2xl font-bold">Best Picture</h3>
      <p class="text-sm text-gray-400">2026 club awards · 4 ballots</p>
    </div>
    <div
      class="flex items-center gap-4 rounded-xl border border-yellow-300/40 bg-yellow-300/10 p-4"
    >
      <img :src="pastLivesSvg" alt="" class="aspect-2/3 w-16 rounded-md" />
      <div class="min-w-0 grow">
        <p
          class="flex items-center gap-1 text-xs font-semibold tracking-wide text-yellow-300 uppercase"
        >
          <mdicon name="trophy" :size="14" aria-hidden="true" />
          Winner
        </p>
        <p class="text-xl font-bold">Past Lives</p>
        <p class="text-sm text-gray-300">Ranked first on 3 of 4 ballots</p>
      </div>
      <p class="text-2xl font-extrabold text-yellow-300">
        14 <span class="text-sm font-normal text-gray-300">pts</span>
      </p>
    </div>
    <ol class="flex flex-col gap-2" aria-label="Runners-up">
      <li
        v-for="(runnerUp, index) in RUNNERS_UP"
        :key="runnerUp.title"
        class="bg-lowBackground flex items-center gap-3 rounded-xl px-4 py-2"
      >
        <span class="w-5 font-bold text-gray-300">{{ index + 2 }}</span>
        <img :src="runnerUp.poster" alt="" class="aspect-2/3 w-7 rounded" />
        <span class="grow font-semibold">{{ runnerUp.title }}</span>
        <span class="font-bold">
          {{ runnerUp.points }} <span class="text-xs font-normal text-gray-400">pts</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { AwardsStep } from "@/../lib/types/awards";
import pastLivesSvg from "@/assets/images/landing/past-lives.svg";
import perfectDaysSvg from "@/assets/images/landing/perfect-days.svg";
import holdoversSvg from "@/assets/images/landing/the-holdovers.svg";
import AwardsStepper from "@/features/awards/components/AwardsStepper.vue";

const RUNNERS_UP = [
  { title: "Perfect Days", poster: perfectDaysSvg, points: 11 },
  { title: "The Holdovers", poster: holdoversSvg, points: 9 },
];
</script>
