<template>
  <div ref="galleryContainerRef" class="flex">
    <div class="w-full md:px-6">
      <div class="relative mb-4 flex max-w-full flex-wrap items-center gap-2">
        <Listbox v-model="selectedSort">
          <div class="relative">
            <ListboxButton
              class="flex items-center gap-1 whitespace-nowrap rounded-full border border-white px-4 py-1"
            >
              <span>{{ activeSortOption ? "Sorted by" : "Sort by" }}</span>
              <span v-if="activeSortOption" class="font-semibold">{{
                activeSortOption.label
              }}</span>
              <mdicon name="chevron-down" />
            </ListboxButton>
            <ListboxOptions
              class="absolute z-10 mt-1 max-h-80 overflow-auto rounded-md border border-white bg-background py-1"
            >
              <p class="px-3 py-1 text-left text-sm text-gray-400">Sort reviews by</p>
              <ListboxOption
                v-for="option in sortOptions"
                v-slot="{ selected }"
                :key="option.id"
                :value="option.id"
              >
                <div
                  class="flex min-w-52 cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-lowBackground"
                >
                  <VAvatar
                    v-if="option.type === 'member'"
                    :src="option.image"
                    :name="option.name"
                    :size="24"
                  />
                  <img
                    v-else-if="option.type === 'average'"
                    :src="AverageImg"
                    class="h-6 w-6 max-w-none"
                  />
                  <mdicon v-else name="clock-outline" class="w-6" />
                  <span class="flex-grow">{{ option.label }}</span>
                  <mdicon v-if="selected" name="check" class="text-primary" />
                </div>
              </ListboxOption>
            </ListboxOptions>
          </div>
        </Listbox>

        <button
          v-if="activeSortOption"
          type="button"
          class="flex items-center gap-2 whitespace-nowrap rounded-full border border-white px-4 py-1 hover:bg-lowBackground"
          :title="`Currently ${directionLabel.toLowerCase()}. Click to reverse.`"
          @click="reverseSort"
        >
          <mdicon :name="sort?.desc ? 'chevron-down' : 'chevron-up'" />
          <span>{{ directionLabel }}</span>
        </button>
        <button
          v-if="activeSortOption"
          type="button"
          class="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-white px-4 py-1 hover:bg-lowBackground"
          @click="selectedSort = undefined"
        >
          Clear
          <mdicon name="close" />
        </button>
      </div>

      <!-- Removal stays instant (absolute hidden) so filtering never lags;
           the named transition adds enter and FLIP-move animation on top. -->
      <transition-group
        tag="div"
        name="gallery"
        leave-active-class="absolute hidden"
        class="grid w-full justify-items-center gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(168px, 1fr))"
      >
        <WorkPosterCard
          v-for="review in sortedReviews"
          :key="review.id"
          :data-movie-id="review.id"
          :title="review.title"
          :poster-url="review.imageUrl ?? ''"
          :highlighted="selectedMovieId === review.id"
          selectable
          class="transition-all duration-fast ease-standard md:cursor-pointer"
          @select="openMovieDetails(review)"
        >
          <div class="mb-2 text-sm text-gray-400">
            {{ formatCardDate(review.createdDate) }}
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="entry in workScoreEntries(review, members)"
              :key="entry.id"
              class="flex items-center rounded-3xl bg-slate-600"
            >
              <ScoreLabel :entry="entry" />
              <div class="flex-grow text-sm">
                <!-- Cards never reveal on click: reveal flows through the
                     details drawer's own pill. -->
                <span
                  :class="[
                    isDefined(entry.memberId) ? '' : 'text-lg font-bold text-primary',
                    isScoreBlurred(entry, currentUserId, isRevealed(review.id))
                      ? 'blur filter'
                      : '',
                  ]"
                  >{{ entry.value }}</span
                >
              </div>
            </div>
          </div>
        </WorkPosterCard>
      </transition-group>
    </div>

    <!-- Movie Details Drawer -->
    <WorkDetailsDrawer
      v-if="selectedMovie"
      :key="selectedMovie.id"
      :movie="selectedMovie"
      :members="members"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      @toggle-reveal="toggleMovieReveal"
      @close="selectedMovieId = undefined"
    />
  </div>
</template>

<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { DateTime } from "luxon";
import { computed, ref, nextTick, watch } from "vue";

import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem } from "../../../../lib/types/lists";
import { isScoreBlurred, workScoreEntries } from "../reviewScores";
import { ReviewSort, reviewSortOptions, sortReviews } from "../reviewSort";
import ScoreLabel from "./ScoreLabel.vue";
import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const props = defineProps<{
  reviews: DetailedReviewListItem[];
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", movieId: string): void;
}>();

const sort = ref<ReviewSort>();

const sortOptions = computed(() => reviewSortOptions(props.members));

const sortedReviews = computed(() => sortReviews(props.reviews, sort.value));

const activeSortOption = computed(() =>
  sortOptions.value.find((option) => option.id === sort.value?.id),
);

// Direction words depend on what's being sorted: dates read newest/oldest,
// ratings read highest/lowest. A bare up/down chevron didn't convey either.
const directionLabel = computed(() => {
  if (!isDefined(sort.value)) return "";
  if (activeSortOption.value?.type === "date") {
    return sort.value.desc ? "Newest first" : "Oldest first";
  }
  return sort.value.desc ? "Highest first" : "Lowest first";
});

const reverseSort = () => {
  if (!isDefined(sort.value)) return;
  sort.value = { id: sort.value.id, desc: !sort.value.desc };
};

const selectedSort = computed<string | undefined>({
  get: () => sort.value?.id,
  set: (value: string | undefined) => {
    sort.value = isDefined(value) ? { id: value, desc: true } : undefined;
  },
});

// Cards carry the compact numeric date; the details drawer spells it out.
const formatCardDate = (createdDate: string) => DateTime.fromISO(createdDate).toLocaleString();

const isRevealed = (movieId: string) =>
  props.hasRated(movieId) || props.revealedMovieIds.has(movieId);

const selectedMovieId = ref<string | undefined>(undefined);

const selectedMovie = computed(() => {
  if (selectedMovieId.value === undefined) return undefined;
  return props.reviews.find((review) => review.id === selectedMovieId.value);
});

const openMovieDetails = async (review: DetailedReviewListItem) => {
  if (selectedMovieId.value !== review.id) {
    selectedMovieId.value = review.id;

    await nextTick();
    // Find the clicked movie element and scroll to center it on page
    const clickedElement = document.querySelector(`[data-movie-id="${review.id}"]`);

    if (clickedElement) {
      clickedElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    } else {
      selectedMovieId.value = undefined;
    }
  }
};

const toggleMovieReveal = (movieId: string) => {
  emit("toggle-reveal", movieId);
};

watch(selectedMovieId, async (newValue, oldValue) => {
  // When drawer closes (transitions from true to false)
  if (isDefined(oldValue) && !isDefined(newValue)) {
    await nextTick();
    const selectedElement = document.querySelector(`[data-movie-id="${oldValue}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }
});
</script>

<style scoped>
/* Scoped selectors ([data-v-...]) out-specify the card's own transition-all
   utility, so enter/move timing wins over the hover transition. */
.gallery-enter-active {
  transition:
    opacity var(--motion-base) var(--ease-standard),
    transform var(--motion-base) var(--ease-standard);
}

.gallery-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.gallery-move {
  transition: transform var(--motion-slow) var(--ease-emphasized);
}
</style>
