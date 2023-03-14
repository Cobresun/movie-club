<template>
  <div class="flex flex-col items-center">
    <h2 class="text-2xl font-bold m-4">Categories</h2>
    <div class="w-11/12 max-w-lg flex flex-col">
      <movie-table
        :data="clubAward.awards"
        :headers="headers"
        :header="false"
        row-style="bg-lowBackground h-12"
      />
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
import { ref } from "vue";

import { ClubAwards } from "@/common/types/models";
import { useAddCategory } from "@/service/useAwards";

const { clubAward, clubId, year } = defineProps<{
  clubAward: ClubAwards;
  clubId: string;
  year: string;
}>();

const headers = [
  {
    value: "title",
    style: "text-left pl-4",
  },
];

const newCategory = ref("");

const { mutate } = useAddCategory(clubId, year);

const addCategory = () => {
  if (
    newCategory.value !== "" &&
    clubAward.awards.every((award) => award.title !== newCategory.value)
  ) {
    mutate(newCategory.value);
    newCategory.value = "";
  }
};
</script>
