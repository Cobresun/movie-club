<template>
  <div>
    <movie-table
      v-if="tableData.length > 0"
      :headers="headers"
      :data="tableData"
    >
      <template v-for="member in members" :key="member.id" #[member.id]>
        <v-avatar :src="member.image" :name="member.name" />
      </template>

      <template v-for="member in members" #[`item-${member.id}`]="slotProps">
        <div
          v-if="
            slotProps.item[member.id] === undefined && member.id === user?.id
          "
          :key="member.id"
          class="flex justify-center"
        >
          <input
            v-show="activeScoreInput === slotProps.item.id"
            :ref="(e) => scoreInputRefs[slotProps.item.id] = (e as HTMLInputElement)"
            v-model="scoreInputValue"
            aria-label="Score"
            class="bg-background rounded-lg outline-none border border-gray-300 focus:border-primary p-2 w-10 text-center"
            @keypress.enter="
              () => submitScore(slotProps.item.id, parseFloat(scoreInputValue))
            "
          />
          <div
            v-if="activeScoreInput !== slotProps.item.id"
            role="button"
            aria-label="Add score"
            class="cursor-pointer"
            @click="openScoreInput(slotProps.item.id)"
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
import { DetailedReviewListItem } from "@/common/types/lists";
import { useUser } from "@/service/useUser";

const { reviews, members, submitScore } = defineProps<{
  reviews: DetailedReviewListItem[];
  members: Member[];
  submitScore: (movieId: number, score: number) => void;
}>();

const { data: user } = useUser();

const headers = computed<Header[]>(() => {
  const headers: Header[] = [
    { value: "title", style: "font-bold", title: "Title" },
    { value: "createdDate", title: "Date Reviewed" },
  ];

  if (members && members.length > 0) {
    for (const member of members) {
      headers.push({ value: member.id });
    }
  }
  headers.push({ value: "average" });

  return headers;
});

const tableData = computed(() => {
  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < reviews.length; i++) {
    const obj: Record<string, unknown> = {
      title: reviews[i].title,
      createdDate: DateTime.fromISO(reviews[i].createdDate).toLocaleString(),
      id: reviews[i].id,
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
