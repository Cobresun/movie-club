<template>
  <div class="flex flex-col items-center">
    <h2 class="m-4 text-2xl font-bold">Categories</h2>
    <div class="flex w-11/12 max-w-lg flex-col text-left">
      <p v-if="!hasElements(categories)" class="mb-4 text-gray-400">
        No categories yet. Add your own below or pick from the suggestions.
      </p>
      <VueDraggableNext v-model="categories" tag="ul" handle=".drag-handle" aria-label="Categories">
        <li
          v-for="(element, index) in categories"
          :key="element.title"
          class="mb-2 flex min-h-12 items-center justify-between gap-2 rounded-xl bg-lowBackground py-2 pl-4 pr-2"
        >
          <span class="min-w-0 break-words">{{ element.title }}</span>
          <div class="flex flex-shrink-0 items-center">
            <button
              v-if="index > 0"
              type="button"
              class="rounded p-1 hover:bg-white/10"
              :aria-label="`Move ${element.title} up`"
              @click="move(index, index - 1)"
            >
              <mdicon name="chevron-up" />
            </button>
            <button
              v-if="index < categories.length - 1"
              type="button"
              class="rounded p-1 hover:bg-white/10"
              :aria-label="`Move ${element.title} down`"
              @click="move(index, index + 1)"
            >
              <mdicon name="chevron-down" />
            </button>
            <button
              type="button"
              class="rounded p-1 hover:bg-white/10"
              :aria-label="`Remove ${element.title}`"
              @click="deleteCategory(element.title)"
            >
              <mdicon name="delete-outline" />
            </button>
            <mdicon class="drag-handle cursor-grab p-1" name="drag" aria-hidden="true" />
          </div>
        </li>
      </VueDraggableNext>

      <form class="mt-2 flex items-start gap-2" @submit.prevent="submitNewCategory">
        <v-text-field
          v-model="newCategory"
          class="flex-grow"
          label="New category"
          placeholder="e.g. Best Soundtrack"
          :maxlength="AWARD_TITLE_MAX_LENGTH"
          :error="error"
        />
        <v-btn class="mt-[26px] min-h-[50px] px-2">Add</v-btn>
      </form>

      <div v-if="hasElements(suggestions)" class="mt-6">
        <h3 class="mb-2 text-[13px] font-medium text-white/60">Suggestions</h3>
        <ul class="flex flex-wrap gap-2">
          <li v-for="suggestion in suggestions" :key="suggestion">
            <button
              type="button"
              class="flex items-center gap-1 rounded-full bg-lowBackground py-1 pl-2 pr-3 text-sm hover:brightness-125"
              :aria-label="`Add ${suggestion}`"
              @click="addCategory(suggestion)"
            >
              <mdicon name="plus" :size="16" />{{ suggestion }}
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import { VueDraggableNext } from "vue-draggable-next";

import {
  AWARD_TITLE_MAX_LENGTH,
  awardTitleSchema,
  isSameCategoryTitle,
} from "../../../../lib/awards";
import { hasElements } from "../../../../lib/checks/checks.js";
import { Award, ClubAwards } from "../../../../lib/types/awards";
import { SUGGESTED_CATEGORIES } from "../constants";
import { useAddCategory, useDeleteCategory, useReorderCategories } from "@/service/useAwards";

const { clubAward, clubSlug, year } = defineProps<{
  clubAward: ClubAwards;
  clubSlug: string;
  year: string;
}>();

const { mutate: reorderCategories } = useReorderCategories(clubSlug, year);
const { mutate: addCategoryMutation } = useAddCategory(clubSlug, year);
const { mutate: deleteCategory } = useDeleteCategory(clubSlug, year);

const categories = computed({
  get: () => clubAward.awards,
  set: (reordered: Award[]) => reorderCategories(reordered.map((award) => award.title)),
});

const move = (from: number, to: number) => {
  const reordered = [...categories.value];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  categories.value = reordered;
};

const isTaken = (title: string) =>
  clubAward.awards.some((award) => isSameCategoryTitle(award.title, title));

const suggestions = computed(() => SUGGESTED_CATEGORIES.filter((title) => !isTaken(title)));

const newCategory = ref("");
const error = ref<string>();

const addCategory = (title: string) => {
  const parsed = awardTitleSchema.safeParse(title);
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message;
    return false;
  }
  if (isTaken(parsed.data)) {
    error.value = `"${parsed.data}" is already a category`;
    return false;
  }
  error.value = undefined;
  addCategoryMutation(parsed.data);
  return true;
};

const submitNewCategory = () => {
  if (addCategory(newCategory.value)) newCategory.value = "";
};
</script>
