<template>
  <div>
    <div class="flex justify-between items-center">
      <input
        v-model="searchTerm"
        class="flex-grow h-8 p-2 text-base outline-none rounded-md border-2 text-white border-slate-600 focus:border-primary w-full bg-background"
        size="18"
        placeholder="Search"
      />
      <div>
        <v-btn class="ml-2 whitespace-nowrap" @click="openPrompt()">
          Add Review
          <mdicon name="plus" />
        </v-btn>
      </div>
    </div>
    <movie-table
      v-if="tableData.length > 0"
      :headers="headers"
      :data="tableData"
    >
      <template v-for="member in members" :key="member.name" #[member.name]>
        <v-avatar :src="member.image" :name="member.name" />
      </template>

      <template v-for="member in members" #[`item-${member.name}`]="slotProps">
        <div
          v-if="
            slotProps.item[member.name] === undefined &&
            member.name === user?.name
          "
          :key="member.name"
          class="flex justify-center"
        >
          <input
            v-show="activeScoreInput === slotProps.item.movieId"
            :ref="(e) => scoreInputRefs[slotProps.item.movieId] = (e as HTMLInputElement)"
            v-model="scoreInputValue"
            class="bg-background rounded-lg outline-none border border-gray-300 focus:border-primary p-2 w-10 text-center"
            @keypress.enter="
              () =>
                submitScore(slotProps.item.movieId, parseFloat(scoreInputValue))
            "
          />
          <div
            v-if="activeScoreInput !== slotProps.item.movieId"
            class="cursor-pointer"
            @click="openScoreInput(slotProps.item.movieId)"
          >
            <mdicon name="plus" />
          </div>
        </div>
      </template>

      <template #average>
        <img src="@/assets/images/average.svg" class="w-16 h-12 max-w-none" />
      </template>
    </movie-table>
  </div>
</template>

<script setup lang="ts">
import { DateTime } from "luxon";
import { ref, computed, nextTick } from "vue";

import { filterReviews } from "../searchReviews";

import { DetailedReviewResponse, Header, Member } from "@/common/types/models";
import { useUser } from "@/service/useUser";

const { reviews, members, openPrompt, submitScore } = defineProps<{
  reviews: DetailedReviewResponse[];
  members: Member[];
  openPrompt: () => void;
  submitScore: (movieId: number, score: number) => void;
}>();

const { data: user } = useUser();

const headers = computed<Header[]>(() => {
  const headers: Header[] = [
    { value: "movieTitle", style: "font-bold", title: "Title" },
    { value: "dateWatched", title: "Date Reviewed" },
  ];

  if (members && members.length > 0) {
    for (const member of members) {
      if (!member.devAccount) {
        headers.push({ value: member.name });
      }
    }
  }
  headers.push({ value: "average" });

  return headers;
});

const tableData = computed(() => {
  if (!filteredReviews.value) return [];
  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < filteredReviews.value.length; i++) {
    const obj: Record<string, unknown> = {
      movieTitle: filteredReviews.value[i].movieTitle,
      dateWatched: DateTime.fromISO(
        filteredReviews.value[i].timeWatched["@ts"]
      ).toLocaleString(),
      movieId: filteredReviews.value[i].movieId,
    };

    for (const key of Object.keys(filteredReviews.value[i].scores)) {
      const score = filteredReviews.value[i].scores[key];
      // Round the score to 2 decimal places
      obj[key] = Math.round(score * 100) / 100;
    }
    data[i] = obj;
  }
  return data;
});

const scoreInputRefs = ref<Record<number, HTMLInputElement | null>>({});

const scoreInputValue = ref("");

const activeScoreInput = ref(-1);

const openScoreInput = (movieId: number) => {
  scoreInputValue.value = "";
  activeScoreInput.value = movieId;
  nextTick(() => {
    const ref = scoreInputRefs.value[activeScoreInput.value];
    if (ref !== null) {
      ref.focus();
    }
  });
};

const searchTerm = ref<string>("");

const filteredReviews = computed(() => {
  return filterReviews(reviews ?? [], searchTerm.value);
});
</script>
