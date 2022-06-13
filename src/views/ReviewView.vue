<template>
  <div class="p-2">
    <add-review-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="grid items-center grid-cols-centerHeader gap-x-8">
        <router-link
          class="flex justify-end"
          :to="{ name: 'ClubHome' }"
        >
          <mdicon
            class="cursor-pointer"
            name="arrow-left"
            size="40"
          />
        </router-link>
        <h1 class="text-3xl font-bold m-4">
          Cobresun Reviews
        </h1>
      </div>
      <loading-spinner v-if="loading" />
      <div v-else>
        <v-btn 
          class="float-left"
          @click="openPrompt()"
        >
          Add Review
          <mdicon name="plus" />
        </v-btn>
        <movie-table
          v-if="reviews.length > 0"
          :headers="headers"
          :data="tableData"
        >
          <template
            v-for="member in members"
            :key="member.name"
            #[member.name]
          >
            <v-avatar
              :src="member.image"
              :name="member.name"
            />
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
              <!-- I don't know why the compiler complains about the next line. It is typed fine and compiles fine -->
              <input
                v-show="activeScoreInput === getScoreInputRefKey(slotProps.item.movieId, member.name)"
                :ref="(e) => scoreInputRefs[getScoreInputRefKey(slotProps.item.movieId, member.name)] = e"
                v-model="scoreInputValue"
                class=" bg-background rounded-lg outline-none border border-gray-300 focus:border-primary p-2 w-10 text-center"
                @keypress.enter="submitScore(slotProps.item.movieId, member.name)"
              >
              <div
                v-if="activeScoreInput !== getScoreInputRefKey(slotProps.item.movieId, member.name)" 
                class="cursor-pointer"
                @click="openScoreInput(slotProps.item.movieId, member.name)"
              >
                <mdicon name="plus" />
              </div>
            </div>
          </template>

          <template #average>
            <img
              src="@/assets/average.svg"
              class="w-16 h-12 max-w-none"
            >
          </template>
        </movie-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useStore } from "vuex";
import { useRoute } from 'vue-router';
import AddReviewPrompt from '@/components/SearchPrompt/AddReviewPrompt.vue';
import { Header, Member, ReviewResponse, Club } from '@/models';
import axios from 'axios'
import { DateTime } from "luxon";

const store = useStore();
const route = useRoute();

const loadingReviews = ref(true);
const loadingMembers = ref(true);
const loading = computed(() => loadingReviews.value || loadingMembers.value);

const reviews = ref<ReviewResponse[]>([]);
const members = ref<Member[]>([]);

axios
  .get('/api/reviews')
  .then((response) => {
    loadingReviews.value = false;
    reviews.value = response.data;
  });

axios
  .get<Club>(`/api/club/${route.params.clubId}`)
  .then((response) => {
    loadingMembers.value = false;
    members.value = response.data.members;
  });

const modalOpen = ref(false);
const openPrompt = () => { modalOpen.value = true };
const closePrompt = (newReview?: ReviewResponse) => {
  modalOpen.value = false;
  if (newReview) {
    reviews.value.unshift(newReview);
  }
}

const headers = computed<Header[]>(() => {
  const headers: Header[] = [
    {value: "movieTitle", style:"font-bold", title:"Title"},
    {value: "dateWatched", title:"Date Reviewed"}
  ];

  if (members.value.length > 0) {
    for (const member of members.value) {
      if (!member.devAccount) {
        headers.push({value: member.name});
      }
    }
  }
  headers.push({value: "average"});

  return headers;
})

const tableData = computed(() => {
  const data: Record<string, unknown>[] = [];
    for (let i = 0; i < reviews.value.length; i++) {
      const obj: Record<string, unknown> = {
        movieTitle: reviews.value[i].movieTitle,
        dateWatched : DateTime.fromISO(reviews.value[i].timeWatched['@ts']).toLocaleString(),
        movieId : reviews.value[i].movieId
      };

      for (const key of Object.keys(reviews.value[i].scores)) {
        const score = reviews.value[i].scores[key];
        // Round the score to 2 decimal places
        obj[key] = Math.round(score * 100)/100;
      }
      data[i] = obj;
    }
  return data;
})

const scoreInputRefs = ref<Record<string, HTMLInputElement | null>>({});
const getScoreInputRefKey = (movieId: number, user: string) => {
  return `${movieId}-${user}`
}

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
}
const submitScore = (movieId: number, user: string) => {
    let newScore = parseFloat(scoreInputValue.value);

    if (!isNaN(newScore) && newScore >= 0 && newScore <= 10) {
      axios
        .post(`/api/postReviewScore?movieId=${ movieId }&user=${ user }&score=${ newScore }`, {}, {
          headers: {
            Authorization: `Bearer ${store.state.auth.user.token.access_token}`
          }
        })
        .then(response => {
          let newReview = reviews.value.find(review => review.movieId === movieId)
          if (newReview !== undefined) {
            newReview.scores = response.data.scores
          }
        })
    }
  }
</script>