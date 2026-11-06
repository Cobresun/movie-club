<template>
  <section aria-labelledby="landing-extras-heading" class="mx-auto max-w-6xl py-16 lg:py-24">
    <h2
      id="landing-extras-heading"
      class="mb-10 max-w-2xl text-left text-3xl leading-tight font-bold md:text-4xl"
    >
      The little things that make club night easier
    </h2>
    <div class="grid gap-4 md:grid-cols-2">
      <article
        class="bg-background flex flex-col gap-5 rounded-2xl border border-white/10 p-6 text-left"
      >
        <div>
          <h3 class="text-xl font-bold">Can’t pick a number? Compare.</h3>
          <p class="mt-1 text-gray-300">
            Score Assist asks which of two films you liked more, then suggests a score that fits
            everything else you’ve rated.
          </p>
        </div>
        <figure class="bg-lowBackground/50 flex flex-col items-center gap-3 rounded-xl p-4">
          <figcaption class="font-bold">Which did you like more?</figcaption>
          <div class="flex gap-3">
            <img
              :src="perfectDaysSvg"
              alt="Perfect Days"
              class="ring-primary aspect-2/3 w-24 rounded-lg ring-4"
            />
            <img :src="duneSvg" alt="Dune: Part Two" class="aspect-2/3 w-24 rounded-lg" />
          </div>
          <p class="text-sm text-gray-400">Suggested score: 8.4</p>
        </figure>
      </article>

      <article
        class="bg-background flex flex-col gap-5 rounded-2xl border border-white/10 p-6 text-left"
      >
        <div>
          <h3 class="text-xl font-bold">No more “what should we watch?”</h3>
          <p class="mt-1 text-gray-300">
            Keep a shared watchlist, spin it when nobody can decide, and see where tonight’s movie
            is streaming.
          </p>
        </div>
        <div class="bg-lowBackground/50 flex flex-col gap-3 rounded-xl p-4">
          <div class="bg-secondary flex items-center gap-3 rounded-xl p-3">
            <mdicon
              name="dice-multiple-outline"
              :size="32"
              class="text-highlight"
              aria-hidden="true"
            />
            <div class="min-w-0 grow" aria-live="polite">
              <p class="text-xs font-semibold tracking-wide text-gray-300 uppercase">
                Tonight’s pick
              </p>
              <p class="font-bold">{{ pick.title }}</p>
              <p class="text-xs text-gray-300">Added by {{ pick.addedBy }}</p>
            </div>
            <v-btn @click="spin">Spin again</v-btn>
          </div>
          <p class="text-sm text-gray-400">{{ PICKS.length - 1 }} more on the club watchlist</p>
        </div>
      </article>

      <article
        class="bg-background flex flex-col gap-5 rounded-2xl border border-white/10 p-6 text-left"
      >
        <div>
          <h3 class="text-xl font-bold">Questions ready before the credits roll</h3>
          <p class="mt-1 text-gray-300">
            Generate discussion questions for any pick, so the conversation goes past “yeah, it was
            good.”
          </p>
        </div>
        <div class="bg-lowBackground/50 flex flex-col gap-3 rounded-xl p-4">
          <p class="flex items-center gap-2 text-sm font-semibold text-gray-300">
            <mdicon name="comment-text-outline" :size="18" aria-hidden="true" />
            Past Lives
          </p>
          <ol class="flex flex-col gap-2">
            <li v-for="(question, index) in QUESTIONS" :key="question" class="flex gap-2">
              <span class="font-bold text-purple-300">{{ index + 1 }}.</span>
              <span>{{ question }}</span>
            </li>
          </ol>
        </div>
      </article>

      <article
        class="bg-background flex flex-col gap-5 rounded-2xl border border-white/10 p-6 text-left"
      >
        <div>
          <h3 class="text-xl font-bold">One link in, one link out</h3>
          <p class="mt-1 text-gray-300">
            Invite members with a single link. Share a review, a list or your stats page with
            anyone. They don’t need an account to look.
          </p>
        </div>
        <div class="bg-lowBackground/50 flex flex-col gap-3 rounded-xl p-4">
          <p
            class="bg-lowBackground flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <mdicon name="link-variant" :size="18" aria-hidden="true" />
            Join Thursday Night Film Society
          </p>
          <div class="flex items-center gap-3 rounded-xl border border-white/10 p-3">
            <img :src="holdoversSvg" alt="" class="aspect-2/3 w-10 rounded" />
            <div class="min-w-0 grow">
              <p class="font-semibold">The Holdovers</p>
              <p class="text-xs text-gray-400">Shared from Thursday Night Film Society</p>
            </div>
            <p class="text-2xl font-bold">7.9</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import duneSvg from "@/assets/images/landing/dune-part-two.svg";
import perfectDaysSvg from "@/assets/images/landing/perfect-days.svg";
import holdoversSvg from "@/assets/images/landing/the-holdovers.svg";

const PICKS = [
  { title: "Aftersun", addedBy: "Jordan" },
  { title: "Anatomy of a Fall", addedBy: "Priya" },
  { title: "The Zone of Interest", addedBy: "Sam" },
  { title: "Godzilla Minus One", addedBy: "Maya" },
];

const QUESTIONS = [
  "Was the final walk to the car a choice, or the only option left?",
  "How does Arthur change the way you read Nora and Hae Sung?",
  "What does the film suggest we owe to the people we used to be?",
];

const pickIndex = ref(0);
const pick = computed(() => PICKS[pickIndex.value % PICKS.length]);

const spin = () => {
  pickIndex.value += 1;
};
</script>
