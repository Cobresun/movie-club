<template>
  <div class="relative flex flex-col gap-1.5 text-left">
    <label :for="inputId" class="text-[13px] font-medium text-white/60">Guess a {{ noun }}</label>
    <div
      class="flex items-center rounded-[10px] bg-lowBackground ring-1 ring-inset ring-white/[0.12] focus-within:ring-2 focus-within:ring-primary"
    >
      <mdicon name="magnify" :size="21" class="ml-3 text-white/40" aria-hidden="true" />
      <input
        :id="inputId"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        placeholder="Start typing a title"
        aria-autocomplete="list"
        :aria-expanded="isOpen"
        :aria-controls="listId"
        :aria-activedescendant="isOpen ? optionId(activeIndex) : undefined"
        class="min-h-[50px] min-w-0 flex-grow bg-transparent px-3 text-[15px] text-white placeholder-white/35 focus:outline-none"
        @focus="open = true"
        @blur="open = false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="open = false"
      />
    </div>
    <ul
      v-show="isOpen"
      :id="listId"
      role="listbox"
      :aria-label="`Matching ${noun}s`"
      class="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-[10px] bg-secondary shadow-lg ring-1 ring-white/[0.12]"
    >
      <!-- mousedown is prevented so the input keeps focus (and the list stays open) until the click lands. -->
      <li
        v-for="(work, index) in matches"
        :id="optionId(index)"
        :key="work.id"
        role="option"
        :aria-selected="index === activeIndex"
        class="cursor-pointer px-3.5 py-2.5"
        :class="{ 'bg-primary/40': index === activeIndex }"
        @mousedown.prevent
        @click="pick(index)"
        @mouseenter="activeIndex = index"
      >
        {{ work.title }}
        <span v-if="isDefined(work.year)" class="text-white/60">({{ work.year }})</span>
      </li>
    </ul>
    <p v-if="query.trim().length > 1 && !hasElements(matches)" class="text-sm text-white/60">
      No {{ noun }} in today's game matches “{{ query.trim() }}”.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from "vue";

import { hasElements, isDefined } from "@/../lib/checks/checks";
import { type DailyGameWork } from "@/../lib/types/dailyGame";
import { searchPool } from "@/features/daily-game/game";

const { pool, noun } = defineProps<{ pool: readonly DailyGameWork[]; noun: string }>();

const emit = defineEmits<{
  (e: "pick", work: DailyGameWork): void;
}>();

const inputId = useId();
const listId = useId();
const optionId = (index: number) => `${listId}-option-${index}`;

const query = ref("");
const activeIndex = ref(0);
const open = ref(false);

const matches = computed(() => searchPool(query.value, pool));
const isOpen = computed(() => open.value && hasElements(matches.value));

watch(query, () => {
  activeIndex.value = 0;
  open.value = true;
});

const move = (step: number) => {
  if (!hasElements(matches.value)) return;
  open.value = true;
  const count = matches.value.length;
  activeIndex.value = (activeIndex.value + step + count) % count;
};

const pick = (index: number) => {
  const work = matches.value.at(index);
  if (!isDefined(work)) return;
  emit("pick", work);
  query.value = "";
};

const onEnter = () => {
  if (isOpen.value) pick(activeIndex.value);
};
</script>
