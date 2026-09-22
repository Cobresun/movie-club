<template>
  <v-modal size="sm" @close="emit('close')">
    <form class="flex flex-col gap-5 text-left" @submit.prevent="submit">
      <div>
        <h2 class="text-xl font-bold">New awards</h2>
        <p class="mt-1 text-sm text-gray-400">
          Nominees are the movies the club reviewed during the year, so pick the year you're
          celebrating.
        </p>
      </div>

      <v-text-field
        v-model="yearText"
        label="Year"
        :maxlength="4"
        :error="yearError"
        hint="You'll be able to change categories before nominations open."
      />

      <fieldset class="flex flex-col gap-2">
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

      <v-btn class="py-2" :disabled="isLoading">Start {{ yearText }} awards</v-btn>
    </form>
  </v-modal>
</template>
<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { z } from "zod";

import { awardsYearSchema } from "../../../../lib/awards";
import { hasElements } from "../../../../lib/checks/checks.js";
import { STARTER_CATEGORIES } from "../constants";
import { useAwards, useCreateAwardsYear } from "@/service/useAwards";

const { clubSlug, existingYears } = defineProps<{
  clubSlug: string;
  existingYears: number[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created", year: number): void;
}>();

const defaultYear = () => {
  let year = new Date().getFullYear();
  while (existingYears.includes(year)) year -= 1;
  return year;
};

const yearText = ref(String(defaultYear()));
const yearError = ref<string>();

const yearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, "Enter a four-digit year")
  .transform(Number)
  .pipe(
    awardsYearSchema.refine(
      (year) => !existingYears.includes(year),
      "This club already has awards for that year",
    ),
  );

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
  const parsed = yearSchema.safeParse(yearText.value);
  if (!parsed.success) {
    yearError.value = parsed.error.issues[0]?.message;
    return;
  }
  yearError.value = undefined;
  const year = parsed.data;
  mutate(
    { year, categories: categoriesFor(start.value) },
    { onSuccess: () => emit("created", year) },
  );
};
</script>
