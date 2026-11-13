<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-2 pb-16 text-left">
    <header class="flex flex-col items-center gap-3 text-center">
      <h1 class="text-3xl font-bold sm:text-4xl">
        {{ dailyGame.name }} <span class="text-highlight">#{{ game.puzzle }}</span>
      </h1>
      <p class="text-white/70">
        Guess today's mystery {{ noun }}. Every guess is ranked by how close it is — #1 is the
        answer.
      </p>
      <Menu as="div" class="relative">
        <MenuButton
          class="bg-lowBackground duration-slow ease-spring flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-white/[0.12] transition ring-inset hover:bg-white/10 active:scale-92 active:duration-75"
        >
          <mdicon
            :name="game.finished.value ? 'help-circle-outline' : 'lightbulb-on-outline'"
            :size="20"
            class="text-highlight"
          />
          {{ game.finished.value ? "Help" : "Hints & help" }}
          <mdicon name="chevron-down" :size="18" class="text-white/70" />
        </MenuButton>
        <transition
          enter-active-class="transition duration-fast ease-standard"
          enter-from-class="-translate-y-1 scale-95 opacity-0"
          leave-active-class="transition duration-fast ease-standard"
          leave-to-class="-translate-y-1 scale-95 opacity-0"
        >
          <MenuItems
            class="bg-lowBackground absolute top-full left-1/2 z-50 mt-1 min-w-[200px] origin-top -translate-x-1/2 overflow-hidden rounded-xl py-1.5 text-left shadow-lg"
          >
            <MenuItem v-slot="{ active }">
              <button
                class="flex w-full items-center gap-3 px-4 py-2.5"
                :class="active ? 'bg-white/10' : ''"
                @click="showRules = true"
              >
                <mdicon name="help-circle-outline" :size="20" />
                How to play
              </button>
            </MenuItem>
            <template v-if="!game.finished.value">
              <MenuItem v-slot="{ active, disabled }" :disabled="!game.canHint.value">
                <button
                  class="flex w-full items-center gap-3 px-4 py-2.5"
                  :class="[active ? 'bg-white/10' : '', disabled ? 'opacity-40' : '']"
                  @click="takeHint"
                >
                  <mdicon name="lightbulb-on-outline" :size="20" />
                  Hint
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  class="flex w-full items-center gap-3 px-4 py-2.5"
                  :class="active ? 'bg-white/10' : ''"
                  @click="confirmingGiveUp = true"
                >
                  <mdicon name="flag-outline" :size="20" />
                  Give up
                </button>
              </MenuItem>
            </template>
          </MenuItems>
        </transition>
      </Menu>
    </header>

    <section
      v-if="game.finished.value"
      aria-labelledby="daily-game-result"
      class="from-secondary to-lowBackground relative flex flex-col items-center gap-3 rounded-xl bg-linear-to-br p-6 text-center shadow-lg"
      :class="{ 'result-pop': celebrating, 'animate-fade-up': finishedNow && !celebrating }"
    >
      <ConfettiBurst v-if="celebrating" />
      <h2 id="daily-game-result" class="text-xl font-bold">
        {{ game.solved.value ? "You got it!" : "Better luck tomorrow" }}
      </h2>
      <p class="text-white/80">
        Today's {{ noun }} was <strong class="text-white">{{ game.answer?.title }}</strong
        ><template v-if="isDefined(game.answer?.year)"> ({{ game.answer.year }})</template>.
      </p>
      <p v-if="game.solved.value" class="text-white/80">
        {{ guessSummary }}
      </p>
      <dl class="mt-1 flex gap-8">
        <div
          v-for="(stat, index) in stats"
          :key="stat.label"
          role="group"
          :aria-label="stat.label"
          class="flex flex-col-reverse"
        >
          <dt class="text-xs tracking-wide text-white/60 uppercase">{{ stat.label }}</dt>
          <dd
            class="text-2xl font-bold"
            :class="{ 'stat-pop': finishedNow }"
            :style="{ '--i': index }"
          >
            {{ stat.value }}
          </dd>
        </div>
      </dl>
      <v-btn
        class="duration-slow! ease-spring! mt-2 px-3 active:scale-92! active:duration-75!"
        :aria-label="shareLabel"
        @click="shareResult"
      >
        <mdicon
          :key="copied ? 'check' : 'share-variant'"
          :name="copied ? 'check' : 'share-variant'"
          :size="20"
          class="mr-2"
          :class="{ 'icon-pop': copied }"
        />
        {{ copied ? "Copied" : "Share result" }}
      </v-btn>
      <p class="text-sm text-white/60">A new {{ noun }} arrives at midnight.</p>
    </section>

    <template v-else>
      <GuessInput ref="guessInput" :pool="game.pool" :noun="noun" @pick="onPick" />
      <p v-if="hasValue(notice)" role="status" class="text-highlight -mt-3 text-sm">
        {{ notice }}
      </p>
      <div
        v-if="offerHint"
        class="bg-lowBackground animate-fade-up -mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/80"
      >
        <mdicon name="lightbulb-on-outline" :size="20" class="text-highlight shrink-0" />
        <p class="grow">Stuck? A hint reveals a {{ noun }} halfway to the answer.</p>
        <v-btn
          class="duration-slow! ease-spring! shrink-0 px-2 text-sm active:scale-92! active:duration-75!"
          @click="takeHint"
          >Get a hint</v-btn
        >
      </div>
    </template>

    <section v-if="isDefined(spotlight)" aria-labelledby="daily-game-latest">
      <h2
        id="daily-game-latest"
        class="mb-2 text-sm font-semibold tracking-wide text-white/60 uppercase"
      >
        Latest guess
      </h2>
      <ul>
        <GuessRow
          :key="spotlight.work.id"
          :guess="spotlight"
          highlighted
          :arrival="spotlight.work.id === freshId ? 'featured' : 'none'"
          :closest-yet="spotlightIsClosest"
          :nudge="nudgeFor(spotlight.work.id)"
        />
      </ul>
    </section>

    <section v-if="hasElements(game.guesses.value)" aria-labelledby="daily-game-guesses">
      <div class="mb-2 flex items-baseline justify-between">
        <h2
          id="daily-game-guesses"
          class="text-sm font-semibold tracking-wide text-white/60 uppercase"
        >
          Your guesses, closest first
        </h2>
        <p class="text-sm text-white/60">{{ countSummary }}</p>
      </div>
      <ul class="flex flex-col gap-2" aria-label="Guesses ranked by closeness">
        <TransitionGroup move-class="transition-transform duration-slow ease-emphasized">
          <GuessRow
            v-for="guess in game.guessesByRank.value"
            :key="guess.work.id"
            :guess="guess"
            :highlighted="guess.work.rank === 1"
            :arrival="listArrival(guess)"
            :nudge="nudgeFor(guess.work.id)"
          />
        </TransitionGroup>
      </ul>
    </section>

    <Teleport to="body">
      <v-modal v-if="showRules" size="sm" z-index="60" @close="showRules = false">
        <section aria-labelledby="daily-game-rules" class="flex flex-col gap-4 text-left">
          <h2 id="daily-game-rules" class="text-xl font-bold">How to play</h2>
          <ul class="list-disc space-y-1.5 pl-5 text-sm text-white/80">
            <li>
              There is one mystery {{ noun }} a day, drawn from {{ game.poolSize }} well-known
              {{ noun }}s. You can guess any of them.
            </li>
            <li>
              Each guess gets a rank: #1 is the answer, #2 the next most similar {{ noun }}, and so
              on down to #{{ game.poolSize }}.
            </li>
            <li>{{ dailyGame.similarityRule }} Nothing you can't see counts.</li>
            <li>
              Stuck? A hint reveals a {{ noun }} halfway between your best guess and the answer.
              Your progress is saved on this device, so you can come back to it.
            </li>
          </ul>
          <v-btn
            class="duration-slow! ease-spring! self-end px-4 active:scale-92! active:duration-75!"
            @click="showRules = false"
            >Got it</v-btn
          >
        </section>
      </v-modal>
    </Teleport>

    <DeleteConfirmationModal
      :show="confirmingGiveUp"
      title="Give up?"
      :message="`Today's ${noun} will be revealed, and your streak will start over.`"
      confirm-label="Yes, reveal it"
      @confirm="giveUp"
      @cancel="confirmingGiveUp = false"
    />

    <!-- The banner hides itself from signed-in players. -->
    <SharedPageCtaBanner
      v-if="game.finished.value"
      source="daily_game"
      :utm-source="gameTag(dailyGame.path)"
    />
  </div>
</template>

<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref, useTemplateRef, watch } from "vue";

import { hasElements, hasValue, isDefined } from "@/../lib/checks/checks";
import { type DailyGamePuzzle, type DailyGameWork } from "@/../lib/types/dailyGame";
import { type DailyGameConfig } from "@/common/clubType";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import { useShare } from "@/common/composables/useShare";
import ConfettiBurst from "@/features/daily-game/components/ConfettiBurst.vue";
import GuessInput from "@/features/daily-game/components/GuessInput.vue";
import GuessRow from "@/features/daily-game/components/GuessRow.vue";
import { gameTag, sharedGameUrl } from "@/features/daily-game/game";
import { playerId } from "@/features/daily-game/playerId";
import { type RankedGuess, useDailyGame } from "@/features/daily-game/useDailyGame";
import { useRecordDailyGameResult } from "@/service/useDailyGame";

const { puzzle, dailyGame, noun } = defineProps<{
  puzzle: DailyGamePuzzle;
  dailyGame: DailyGameConfig;
  /** One work of the game's media ("movie"). */
  noun: string;
}>();

const game = useDailyGame(puzzle, dailyGame.name);
const { shareText } = useShare();

const { mutate: recordResult } = useRecordDailyGameResult(puzzle.clubType, puzzle.date);

// Only a game finished on this visit is sent; reopening a finished day isn't a new result.
watch(game.finished, (finished) => {
  if (!finished) return;
  recordResult({
    playerId: playerId(),
    guesses: game.guesses.value.filter((guess) => !guess.hint).map((guess) => guess.work.id),
    hints: game.hintCount.value,
  });
});

const notice = ref<string>();
const confirmingGiveUp = ref(false);
const showRules = ref(false);
const copied = ref(false);

const guessInput = useTemplateRef("guessInput");

// Only what happens during this visit is celebrated: a game restored from
// storage, finished or not, renders still.
const finishedOnArrival = game.finished.value;
const finishedNow = computed(() => game.finished.value && !finishedOnArrival);
const celebrating = computed(() => finishedNow.value && game.solved.value);

const freshId = ref<string>();
const nudged = ref<{ id: string; count: number }>();

const nudgeFor = (id: string) => (nudged.value?.id === id ? nudged.value.count : 0);

const onPick = (work: DailyGameWork) => {
  if (game.guess(work.id) === "duplicate") {
    notice.value = `You already guessed ${work.title} — it's #${work.rank}.`;
    guessInput.value?.shake();
    nudged.value = { id: work.id, count: (nudged.value?.count ?? 0) + 1 };
    return;
  }
  notice.value = undefined;
  freshId.value = work.id;
};

const takeHint = () => {
  game.takeHint();
  freshId.value = game.latestGuess.value?.work.id;
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

const spotlightIsClosest = computed(
  () =>
    isDefined(spotlight.value) &&
    !spotlight.value.hint &&
    game.guessesByRank.value.at(0)?.work.id === spotlight.value.work.id,
);

// A fresh guess gets its full entrance once, wherever the eye is: the
// spotlight when there is one, otherwise its place in the ranked list.
const listArrival = (guess: RankedGuess) => {
  if (guess.work.id !== freshId.value) return "none";
  return isDefined(spotlight.value) ? "quiet" : "featured";
};

// Players who never open the menu don't learn hints exist, so offer one in
// place once they've made a few guesses without taking any.
const HINT_OFFER_AFTER_GUESSES = 5;

const offerHint = computed(
  () =>
    !game.finished.value &&
    game.canHint.value &&
    game.hintCount.value === 0 &&
    game.guessCount.value >= HINT_OFFER_AFTER_GUESSES,
);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const hintText = computed(() => plural(game.hintCount.value, "hint", "hints"));

const guessSummary = computed(() => {
  const guesses = plural(game.guessCount.value, "guess", "guesses");
  return game.hintCount.value === 0
    ? `Solved in ${guesses}.`
    : `Solved in ${guesses} with ${hintText.value}.`;
});

const countSummary = computed(() => {
  const guesses = plural(game.guessCount.value, "guess", "guesses");
  return game.hintCount.value === 0 ? guesses : `${guesses} · ${hintText.value}`;
});

const stats = computed(() => [
  { label: "Played", value: game.stats.value.played },
  { label: "Solved", value: game.stats.value.won },
  { label: "Streak", value: game.stats.value.streak },
]);

const shareLabel = computed(() => (copied.value ? "Result copied" : "Share result"));

const shareResult = async () => {
  copied.value = await shareText({
    text: game.share(sharedGameUrl(window.location.origin, dailyGame.path)),
    copiedMessage: "Result copied — paste it to your friends!",
  });
};
</script>

<style scoped>
.result-pop {
  animation: result-pop 600ms var(--ease-spring) both;
}
@keyframes result-pop {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.92);
  }
}

.stat-pop {
  animation: stat-pop 450ms var(--ease-spring) both;
  animation-delay: calc(var(--i) * 90ms + 300ms);
}
@keyframes stat-pop {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.6);
  }
}

.icon-pop {
  animation: icon-pop 400ms var(--ease-spring);
}
@keyframes icon-pop {
  from {
    transform: scale(0.3) rotate(-30deg);
  }
}
</style>
