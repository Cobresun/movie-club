<template>
  <div>
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
            aria-label="Score"
            class="bg-background rounded-lg outline-none border border-gray-300 focus:border-primary p-2 w-10 text-center"
            @keypress.enter="
              () =>
                submitScore(slotProps.item.movieId, parseFloat(scoreInputValue))
            "
          />
          <div
            v-if="activeScoreInput !== slotProps.item.movieId"
            role="button"
            aria-label="Add score"
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

import { Member } from "@/common/types/club";
import { Header } from "@/common/types/common";
import { Review } from "@/common/types/reviews";
import { useUser } from "@/service/useUser";

const { reviews, members, submitScore } = defineProps<{
  reviews: Review[];
  members: Member[];
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
  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < reviews.length; i++) {
    const obj: Record<string, unknown> = {
      movieTitle: reviews[i].movieTitle,
      dateWatched: DateTime.fromISO(
        reviews[i].timeWatched["@ts"]
      ).toLocaleString(),
      movieId: reviews[i].movieId,
    };

    for (const key of Object.keys(reviews[i].scores)) {
      const score = reviews[i].scores[key];
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
</script>
