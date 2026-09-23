<template>
  <v-modal size="sm" @close="emit('close')">
    <form class="flex flex-col gap-5 text-left" @submit.prevent="submit">
      <div>
        <h2 class="text-xl font-bold">New awards</h2>
        <p class="mt-1 text-sm text-gray-400">
          Nominees are the movies the club reviewed during the year you pick. You'll be able to
          change the categories before nominations open.
        </p>
      </div>

      <div
        v-if="availableLoading"
        class="flex justify-center"
        role="status"
        aria-label="Loading years"
      >
        <loading-spinner />
      </div>
      <p v-else-if="!hasElements(availableYears)" class="text-gray-300">
        {{
          hasElements(existingYears)
            ? "Every year the club reviewed movies in already has awards."
            : "The club hasn't reviewed any movies yet. Once it has, you can hold awards for that year."
        }}
      </p>
      <div v-else class="flex flex-col gap-1.5">
        <label :for="`${id}-year`" class="text-[13px] font-medium text-white/60">Year</label>
        <v-select
          :id="`${id}-year`"
          v-model="yearText"
          class="self-start"
          :items="availableYears.map(String)"
        />
        <p class="text-xs text-white/40">
          Only years the club reviewed movies in and hasn't held awards for yet.
        </p>
      </div>

      <fieldset v-if="hasValue(yearText)" class="flex flex-col gap-2">
        <legend class="mb-2 text-[13px] font-medium text-white/60">Start with</legend>
        <label
          v-for="option in startOptions"
          :key="option.value"
          class="flex cursor-pointer items-start gap-3 rounded-[10px] bg-lowBackground p-3 ring-1 ring-inset ring-white/[0.12] has-[:checked]:ring-2 has-[:checked]:ring-primary"
        >
          <input
            v-model="start"
            type="radio"
            name="start"
            :value="option.value"
            :aria-labelledby="`${id}-${option.value}-label`"
            :aria-describedby="`${id}-${option.value}-detail`"
            class="mt-1 accent-primary"
          />
          <span class="flex flex-col">
            <span :id="`${id}-${option.value}-label`" class="font-semibold">{{
              option.label
            }}</span>
            <span :id="`${id}-${option.value}-detail`" class="text-sm text-gray-400">
              {{ option.detail }}
            </span>
          </span>
        </label>
      </fieldset>

      <v-btn v-if="hasValue(yearText)" class="py-2" :disabled="isLoading">
        Start {{ yearText }} awards
      </v-btn>
    </form>
  </v-modal>
</template>
<script setup lang="ts">
import { computed, ref, useId } from "vue";

import { hasElements, hasValue } from "../../../../lib/checks/checks.js";
import { STARTER_CATEGORIES } from "../constants";
import { useAvailableAwardYears, useAwards, useCreateAwardsYear } from "@/service/useAwards";

const { clubSlug, existingYears } = defineProps<{
  clubSlug: string;
  existingYears: number[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", year: number): void;
}>();

const { data: availableYears, isLoading: availableLoading } = useAvailableAwardYears(clubSlug);

const chosenYear = ref<string>();
const yearText = computed({
  get: () => chosenYear.value ?? availableYears.value?.[0]?.toString() ?? "",
  set: (value: string) => {
    chosenYear.value = value;
  },
});

const latestYear = computed(() => (hasElements(existingYears) ? String(existingYears[0]) : ""));
const { data: latestAwards } = useAwards(ref(clubSlug), latestYear);
const previousCategories = computed(
  () => latestAwards.value?.awards.map((award) => award.title) ?? [],
);

const id = useId();

type Start = "suggested" | "previous" | "blank";

const startOptions = computed(() => [
  {
    value: "suggested" as const,
    label: "Suggested categories",
    detail: STARTER_CATEGORIES.join(", "),
  },
  ...(hasElements(previousCategories.value)
    ? [
        {
          value: "previous" as const,
          label: `The same categories as ${latestYear.value}`,
          detail: previousCategories.value.join(", "),
        },
      ]
    : []),
  { value: "blank" as const, label: "No categories", detail: "Add your own from scratch." },
]);

const start = ref<Start>("suggested");

const categoriesFor = (choice: Start): string[] => {
  switch (choice) {
    case "suggested":
      return [...STARTER_CATEGORIES];
    case "previous":
      return previousCategories.value;
    case "blank":
      return [];
  }
};

const { mutate, isLoading } = useCreateAwardsYear(clubSlug);

const submit = () => {
  const year = Number(yearText.value);
  if (!availableYears.value?.includes(year)) return;
  mutate(
    { year, categories: categoriesFor(start.value) },
    { onSuccess: () => emit("created", year) },
  );
};
</script>
