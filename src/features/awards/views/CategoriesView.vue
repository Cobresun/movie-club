<template>
  <div class="flex flex-col items-center">
    <h2 class="text-2xl font-bold m-4">Categories</h2>
    <div class="w-11/12 max-w-lg flex flex-col">
      <VueDraggableNext v-model="categories">
        <div
          v-for="element in categories"
          :key="element.title"
          class="bg-lowBackground h-12 rounded-xl mb-2 p-4 flex justify-between items-center"
        >
          <p>{{ element.title }}</p>
          <div class="flex">
            <mdicon
              class="mr-2 cursor-pointer"
              name="delete"
              @click="deleteCategory(element)"
            />
            <mdicon class="cursor-grab" name="menu" />
          </div>
        </div>
      </VueDraggableNext>
      <input
        v-model="newCategory"
        class="h-12 pl-4 p-2 text-base outline-none rounded-xl border-2 text-white border-slate-600 focus:border-primary w-full bg-background"
        placeholder="Add category"
        @keypress.enter="addCategory"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, toRefs } from "vue";
import { VueDraggableNext } from "vue-draggable-next";

import { ClubAwards } from "@/common/types/models";
import {
  useAddCategory,
  useDeleteCategory,
  useReorderCategories,
} from "@/service/useAwards";

const props = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const { clubAward, clubId, year } = toRefs(props);

const categories = ref(clubAward.value.awards);
watch(clubAward, () => {
  categories.value = clubAward.value.awards;
});

const newCategory = ref("");

const { mutate: addCategoryMutation } = useAddCategory(
  clubId.value,
  year.value
);

const addCategory = () => {
  if (
    newCategory.value !== "" &&
    clubAward.value.awards.every((award) => award.title !== newCategory.value)
  ) {
    addCategoryMutation(newCategory.value);
    newCategory.value = "";
  }
};

const { mutate: reorderCategories } = useReorderCategories(
  clubId.value,
  year.value
);

watch(categories, () => {
  if (
    categories.value.some(
      (category, index) => clubAward.value.awards[index] !== category
    )
  ) {
    reorderCategories(categories.value.map((category) => category.title));
  }
});

const { mutate: deleteCategory } = useDeleteCategory(clubId.value, year.value);
</script>
