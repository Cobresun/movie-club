<template>
  <div class="px-6 pb-16 md:px-12">
    <section
      class="mx-auto flex max-w-5xl flex-col items-center gap-6 pt-10 pb-12 text-center md:pt-16"
    >
      <ul class="flex flex-wrap justify-center gap-2" aria-label="Club types">
        <li
          v-for="option in clubTypeOptions()"
          :key="option.clubType"
          class="bg-lowBackground flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5 text-sm text-gray-300"
        >
          <mdicon :name="option.icon" :size="16" class="text-highlight" aria-hidden="true" />
          {{ option.pluralLabel }}
        </li>
      </ul>
      <h1 class="max-w-4xl text-4xl leading-tight font-extrabold tracking-tight md:text-6xl">
        The book club for movies. Every opinion on the record.
      </h1>
      <p class="max-w-2xl text-lg leading-relaxed text-gray-300 md:text-xl">
        Score what your club watches, see everyone’s ratings side by side, find out who shares your
        taste, and crown the year’s best at your own awards night.
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <v-btn class="px-4 py-2 text-lg" @click="getStarted">Start your club — it’s free</v-btn>
        <router-link
          v-for="game in dailyGames"
          :key="game.path"
          :to="game.path"
          class="flex items-center rounded-md border border-white/30 px-5 py-2 text-lg font-bold tracking-wide transition hover:bg-white/10"
        >
          Play today’s {{ game.name }}
        </router-link>
      </div>
    </section>

    <LandingClubPreview />

    <LandingShowcase eyebrow="Statistics" title="Find your taste twin. Expose the toughest critic.">
      <p>
        Every score feeds your club’s stats. See who agrees with whom, which picks split the room,
        the genres you keep coming back to, and how your club stacks up against the critics.
      </p>
      <template #preview>
        <LandingStatsPreview />
      </template>
    </LandingShowcase>

    <LandingShowcase eyebrow="Club awards" title="Run your own awards season." reversed>
      <p>
        At the end of the year, invent your categories, nominate from everything you watched, and
        vote. Movie Club tallies the ballots and hands out the trophies at your ceremony.
      </p>
      <template #preview>
        <LandingAwardsPreview />
      </template>
    </LandingShowcase>

    <LandingShowcase eyebrow="Wrapped" title="Your club’s year, told in stories.">
      <p>
        Each year gets a tap-through recap: what you watched, who agreed, the hottest takes, the
        most divisive pick and a trivia round to close it out.
      </p>
      <template #preview>
        <LandingWrappedPreview />
      </template>
    </LandingShowcase>

    <LandingExtras />

    <LandingDailyGamePreview
      v-for="game in dailyGames"
      :key="game.path"
      :daily-game="game"
      :noun="game.noun"
    />

    <section
      aria-labelledby="landing-steps-heading"
      class="mx-auto flex max-w-6xl flex-col gap-10 py-16 text-left lg:py-24"
    >
      <h2 id="landing-steps-heading" class="text-3xl leading-tight font-bold md:text-4xl">
        Up and running before the trailers end
      </h2>
      <ol class="grid gap-4 md:grid-cols-3">
        <li
          v-for="(step, index) in STEPS"
          :key="step.title"
          class="flex flex-col gap-3 rounded-2xl border border-white/15 p-6"
        >
          <span class="text-highlight text-4xl font-extrabold" aria-hidden="true">
            {{ index + 1 }}
          </span>
          <h3 class="text-xl font-bold">{{ step.title }}</h3>
          <p class="text-gray-300">{{ step.description }}</p>
        </li>
      </ol>
    </section>

    <section class="flex flex-col items-center gap-6 py-12 text-center">
      <h2 class="max-w-3xl text-4xl leading-tight font-extrabold tracking-tight md:text-5xl">
        Your next club night deserves a scoreboard.
      </h2>
      <p class="text-lg text-gray-300">Free for your whole club.</p>
      <v-btn class="px-4 py-2 text-lg" @click="getStarted">Start your club</v-btn>
    </section>
  </div>
</template>

<script setup lang="ts">
import LandingAwardsPreview from "../components/landing/LandingAwardsPreview.vue";
import LandingClubPreview from "../components/landing/LandingClubPreview.vue";
import LandingDailyGamePreview from "../components/landing/LandingDailyGamePreview.vue";
import LandingExtras from "../components/landing/LandingExtras.vue";
import LandingShowcase from "../components/landing/LandingShowcase.vue";
import LandingStatsPreview from "../components/landing/LandingStatsPreview.vue";
import LandingWrappedPreview from "../components/landing/LandingWrappedPreview.vue";
import { isDefined } from "@/../lib/checks/checks";
import { clubTypeConfig, clubTypeOptions, dailyGameClubTypes } from "@/common/clubType";
import { useAuthStore } from "@/stores/auth";

const dailyGames = dailyGameClubTypes().flatMap((clubType) => {
  const { noun, dailyGame } = clubTypeConfig(clubType);
  return isDefined(dailyGame) ? [{ noun, ...dailyGame }] : [];
});

const STEPS = [
  {
    title: "Start a club",
    description: "Pick what you’re into and give your club a name.",
  },
  {
    title: "Send one link",
    description: "Drop the invite in your group chat. Friends tap it and they’re in.",
  },
  {
    title: "Score, compare, repeat",
    description: "Stats, hot takes and your year-end awards build themselves as you go.",
  },
];

const authStore = useAuthStore();

function getStarted() {
  authStore.login();
}
</script>
