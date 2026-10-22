<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-16 pt-2 text-left">
    <header class="text-center">
      <h1 class="text-3xl font-bold sm:text-4xl">
        Closer <span class="text-highlight">#{{ game.puzzle }}</span>
      </h1>
      <p class="mt-2 text-white/70">
        Guess today's mystery movie. Every guess is ranked by how close it is — #1 is the answer.
      </p>
    </header>

    <section
      v-if="game.finished.value"
      aria-labelledby="closer-result"
      class="flex flex-col items-center gap-3 rounded-xl bg-gradient-to-br from-secondary to-lowBackground p-6 text-center shadow-lg"
    >
      <h2 id="closer-result" class="text-xl font-bold">
        {{ game.solved.value ? "You got it!" : "Better luck tomorrow" }}
      </h2>
      <p class="text-white/80">
        Today's movie was
        <strong class="text-white">{{ game.answer?.title }}</strong
        ><template v-if="isDefined(game.answer?.year)"> ({{ game.answer.year }})</template>.
      </p>
      <p v-if="game.solved.value" class="text-white/80">
        {{ guessSummary }}
      </p>
      <dl class="mt-1 flex gap-8">
        <div
          v-for="stat in stats"
          :key="stat.label"
          role="group"
          :aria-label="stat.label"
          class="flex flex-col-reverse"
        >
          <dt class="text-xs uppercase tracking-wide text-white/60">{{ stat.label }}</dt>
          <dd class="text-2xl font-bold">{{ stat.value }}</dd>
        </div>
      </dl>
      <v-btn class="mt-2 px-3" :aria-label="shareLabel" @click="shareResult">
        <mdicon :name="copied ? 'check' : 'share-variant'" :size="20" class="mr-2" />
        {{ copied ? "Copied" : "Share result" }}
      </v-btn>
      <p class="text-sm text-white/60">A new movie arrives at midnight.</p>
    </section>

    <template v-else>
      <MovieGuessInput :pool="game.pool" @pick="onPick" />
      <p v-if="hasValue(notice)" role="status" class="-mt-3 text-sm text-highlight">
        {{ notice }}
      </p>
    </template>

    <section v-if="isDefined(spotlight)" aria-labelledby="closer-latest">
      <h2
        id="closer-latest"
        class="mb-2 text-sm font-semibold uppercase tracking-wide text-white/60"
      >
        Latest guess
      </h2>
      <ul>
        <GuessRow :guess="spotlight" highlighted />
      </ul>
    </section>

    <section v-if="hasElements(game.guesses.value)" aria-labelledby="closer-guesses">
      <div class="mb-2 flex items-baseline justify-between">
        <h2 id="closer-guesses" class="text-sm font-semibold uppercase tracking-wide text-white/60">
          Your guesses, closest first
        </h2>
        <p class="text-sm text-white/60">
          {{ game.guesses.value.length }}
          {{ game.guesses.value.length === 1 ? "guess" : "guesses" }}
        </p>
      </div>
      <ul class="flex flex-col gap-2" aria-label="Guesses ranked by closeness">
        <GuessRow
          v-for="guess in game.guessesByRank.value"
          :key="guess.movie.id"
          :guess="guess"
          :highlighted="guess.movie.rank === 1"
        />
      </ul>
    </section>

    <div v-if="!game.finished.value" class="flex flex-wrap justify-center gap-3">
      <v-btn class="px-3" :disabled="!game.canHint.value" @click="game.takeHint">
        <mdicon name="lightbulb-on-outline" :size="20" class="mr-2" />
        Get a hint
      </v-btn>
      <template v-if="confirmingGiveUp">
        <v-btn class="px-3" @click="giveUp">Yes, reveal it</v-btn>
        <v-btn class="px-3" @click="confirmingGiveUp = false">Keep guessing</v-btn>
      </template>
      <v-btn v-else class="px-3" @click="confirmingGiveUp = true">
        <mdicon name="flag-outline" :size="20" class="mr-2" />
        Give up
      </v-btn>
    </div>

    <details class="rounded-xl bg-lowBackground px-4 py-3 text-sm text-white/80">
      <summary class="cursor-pointer font-semibold text-white">How to play</summary>
      <ul class="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          There is one mystery movie a day, drawn from the {{ game.poolSize }} movies Movie Club's
          clubs have added. You can guess any of them.
        </li>
        <li>
          Each guess gets a rank: #1 is the answer, #2 the next most similar film, and so on down to
          #{{ game.poolSize }}.
        </li>
        <li>
          Similarity comes from shared directors, cast, studios, genres, era and language. The clues
          under each guess show what it has in common with the answer.
        </li>
        <li>
          Stuck? A hint reveals a movie halfway between your best guess and the answer. Your
          progress is saved on this device, so you can come back to it.
        </li>
      </ul>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { hasElements, hasValue, isDefined } from "@/../lib/checks/checks";
import type { DailyGameMovie, DailyGamePuzzle } from "@/../lib/types/dailyGame";
import GuessRow from "@/features/daily-game/components/GuessRow.vue";
import MovieGuessInput from "@/features/daily-game/components/MovieGuessInput.vue";
import { useDailyGame } from "@/features/daily-game/useDailyGame";

const { puzzle } = defineProps<{ puzzle: DailyGamePuzzle }>();

const game = useDailyGame(puzzle);
const toast = useToast();

const notice = ref<string>();
const confirmingGiveUp = ref(false);
const copied = ref(false);

const onPick = (movie: DailyGameMovie) => {
  notice.value =
    game.guess(movie.id) === "duplicate"
      ? `You already guessed ${movie.title} — it's #${movie.rank}.`
      : undefined;
};

const giveUp = () => {
  confirmingGiveUp.value = false;
  game.giveUp();
};

// The answer row already sits at the top of the ranked list once the game is
// over, so the spotlight is only for guesses still in play.
const spotlight = computed(() =>
  game.finished.value || game.guesses.value.length < 2 ? undefined : game.latestGuess.value,
);

const guessSummary = computed(() => {
  const count = game.guesses.value.length;
  const hints = game.hintCount.value;
  const hintText = hints === 0 ? "" : ` with ${hints} ${hints === 1 ? "hint" : "hints"}`;
  return `Solved in ${count} ${count === 1 ? "guess" : "guesses"}${hintText}.`;
});

const stats = computed(() => [
  { label: "Played", value: game.stats.value.played },
  { label: "Solved", value: game.stats.value.won },
  { label: "Streak", value: game.stats.value.streak },
]);

const shareLabel = computed(() => (copied.value ? "Result copied" : "Share result"));

const shareResult = async () => {
  try {
    await navigator.clipboard.writeText(game.share(`${window.location.origin}/play`));
    copied.value = true;
    toast.success("Result copied — paste it to your friends!");
  } catch {
    toast.error("Couldn't copy your result");
  }
};
</script>
