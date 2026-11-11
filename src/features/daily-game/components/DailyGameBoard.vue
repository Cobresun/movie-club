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
          class="bg-lowBackground duration-fast ease-standard flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-white/[0.12] transition-colors ring-inset hover:bg-white/10"
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
                  @click="game.takeHint"
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
      class="from-secondary to-lowBackground flex flex-col items-center gap-3 rounded-xl bg-linear-to-br p-6 text-center shadow-lg"
    >
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
          v-for="stat in stats"
          :key="stat.label"
          role="group"
          :aria-label="stat.label"
          class="flex flex-col-reverse"
        >
          <dt class="text-xs tracking-wide text-white/60 uppercase">{{ stat.label }}</dt>
          <dd class="text-2xl font-bold">{{ stat.value }}</dd>
        </div>
      </dl>
      <v-btn class="mt-2 px-3" :aria-label="shareLabel" @click="shareResult">
        <mdicon :name="copied ? 'check' : 'share-variant'" :size="20" class="mr-2" />
        {{ copied ? "Copied" : "Share result" }}
      </v-btn>
      <p class="text-sm text-white/60">A new {{ noun }} arrives at midnight.</p>
    </section>

    <template v-else>
      <GuessInput :pool="game.pool" :noun="noun" @pick="onPick" />
      <p v-if="hasValue(notice)" role="status" class="text-highlight -mt-3 text-sm">
        {{ notice }}
      </p>
      <div
        v-if="offerHint"
        class="bg-lowBackground -mt-2 flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/80"
      >
        <mdicon name="lightbulb-on-outline" :size="20" class="text-highlight shrink-0" />
        <p class="grow">Stuck? A hint reveals a {{ noun }} halfway to the answer.</p>
        <v-btn class="shrink-0 px-2 text-sm" @click="game.takeHint">Get a hint</v-btn>
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
        <GuessRow :guess="spotlight" highlighted />
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
        <GuessRow
          v-for="guess in game.guessesByRank.value"
          :key="guess.work.id"
          :guess="guess"
          :highlighted="guess.work.rank === 1"
        />
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
            <li>
              {{ dailyGame.similarityRule }} The clues under each guess show what it has in common
              with the answer.
            </li>
            <li>
              Stuck? A hint reveals a {{ noun }} halfway between your best guess and the answer.
              Your progress is saved on this device, so you can come back to it.
            </li>
          </ul>
          <v-btn class="self-end px-4" @click="showRules = false">Got it</v-btn>
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
import { computed, ref } from "vue";

import { hasElements, hasValue, isDefined } from "@/../lib/checks/checks";
import { type DailyGamePuzzle, type DailyGameWork } from "@/../lib/types/dailyGame";
import { type DailyGameConfig } from "@/common/clubType";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import { useShare } from "@/common/composables/useShare";
import GuessInput from "@/features/daily-game/components/GuessInput.vue";
import GuessRow from "@/features/daily-game/components/GuessRow.vue";
import { gameTag, sharedGameUrl } from "@/features/daily-game/game";
import { useDailyGame } from "@/features/daily-game/useDailyGame";

const { puzzle, dailyGame, noun } = defineProps<{
  puzzle: DailyGamePuzzle;
  dailyGame: DailyGameConfig;
  /** One work of the game's media ("movie"). */
  noun: string;
}>();

const game = useDailyGame(puzzle, dailyGame.name);
const { shareText } = useShare();

const notice = ref<string>();
const confirmingGiveUp = ref(false);
const showRules = ref(false);
const copied = ref(false);

const onPick = (work: DailyGameWork) => {
  notice.value =
    game.guess(work.id) === "duplicate"
      ? `You already guessed ${work.title} — it's #${work.rank}.`
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
