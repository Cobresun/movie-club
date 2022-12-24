<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <div>
      <page-header :has-back="true" back-route="ClubHome" page-name="Reviews" />
      <loading-spinner v-if="loading" />
      <div v-else>
        <v-btn class="float-left" @click="openPrompt()">
          Add Review
          <mdicon name="plus" />
        </v-btn>
        <movie-table
          v-if="tableData.length > 0"
          :headers="headers"
          :data="tableData"
        >
          <template v-for="member in members" :key="member.name" #[member.name]>
            <v-avatar :src="member.image" :name="member.name" />
          </template>

          <template
            v-for="member in members"
            #[`item-${member.name}`]="slotProps"
          >
            <div
              v-if="slotProps.item[member.name] === undefined"
              :key="member.name"
              class="flex justify-center"
            >
              <input
                v-show="
                  activeScoreInput ===
                  getScoreInputRefKey(slotProps.item.movieId, member.name)
                "
                :ref="(e) => scoreInputRefs[getScoreInputRefKey(slotProps.item.movieId, member.name)] = (e as HTMLInputElement)"
                v-model="scoreInputValue"
                class="bg-background rounded-lg outline-none border border-gray-300 focus:border-primary p-2 w-10 text-center"
                @keypress.enter="
                  submitScore(slotProps.item.movieId, member.name)
                "
              />
              <div
                v-if="
                  activeScoreInput !==
                  getScoreInputRefKey(slotProps.item.movieId, member.name)
                "
                class="cursor-pointer"
                @click="openScoreInput(slotProps.item.movieId, member.name)"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRoute } from "vue-router";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { Header } from "@/common/types/models";
import { DateTime } from "luxon";
import { useReview, useSubmitScore } from "@/service/useReview";
import { useMembers } from "@/service/useClub";

const route = useRoute();

const { loading: loadingReviews, data: reviews } = useReview(
  route.params.clubId as string
);
const { loading: loadingMembers, data: members } = useMembers(
  route.params.clubId as string
);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const headers = computed<Header[]>(() => {
  const headers: Header[] = [
    { value: "movieTitle", style: "font-bold", title: "Title" },
    { value: "dateWatched", title: "Date Reviewed" },
  ];

  if (members.value && members.value.length > 0) {
    for (const member of members.value) {
      if (!member.devAccount) {
        headers.push({ value: member.name });
      }
    }
  }
  headers.push({ value: "average" });

  return headers;
});

const tableData = computed(() => {
  if (!reviews.value) return [];
  const data: Record<string, unknown>[] = [];
  for (let i = 0; i < reviews.value.length; i++) {
    const obj: Record<string, unknown> = {
      movieTitle: reviews.value[i].movieTitle,
      dateWatched: DateTime.fromISO(
        reviews.value[i].timeWatched["@ts"]
      ).toLocaleString(),
      movieId: reviews.value[i].movieId,
    };

    for (const key of Object.keys(reviews.value[i].scores)) {
      const score = reviews.value[i].scores[key];
      // Round the score to 2 decimal places
      obj[key] = Math.round(score * 100) / 100;
    }
    data[i] = obj;
  }
  return data;
});

const scoreInputRefs = ref<Record<string, HTMLInputElement | null>>({});
const getScoreInputRefKey = (movieId: number, user: string) => {
  return `${movieId}-${user}`;
};

const scoreInputValue = ref("");

const activeScoreInput = ref("");

const openScoreInput = (movieId: number, user: string) => {
  scoreInputValue.value = "";
  activeScoreInput.value = getScoreInputRefKey(movieId, user);
  nextTick(() => {
    const ref = scoreInputRefs.value[activeScoreInput.value];
    if (ref !== null) {
      ref.focus();
    }
  });
};

const { submit } = useSubmitScore(route.params.clubId as string);

const submitScore = (movieId: number, user: string) => {
  let newScore = parseFloat(scoreInputValue.value);

  if (!isNaN(newScore) && newScore >= 0 && newScore <= 10) {
    submit(user, movieId, newScore);
  }
};
</script>