<template>
  <div class="flex-grow text-left">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirmation = false"
    />

    <WorkPosterHero
      :poster-url="posterUrl"
      :backdrop-path="movieData?.backdrop_path"
      :title="movie.title"
      :year="displayYear"
      :is-desktop="isDesktop"
    >
      <template v-if="hasValue(metaLine)" #meta>{{ metaLine }}</template>
      <template #date>
        <span
          v-if="isDefined(addedByMember)"
          class="inline-flex items-center gap-2"
        >
          <VAvatar
            :src="addedByMember.image"
            :name="addedByMember.name"
            :size="20"
          />
          <span>
            Added by {{ addedByMember.name }} on
            {{ formatDate(movie.createdDate) }}
          </span>
        </span>
        <template v-else>Added {{ formatDate(movie.createdDate) }}</template>
      </template>
    </WorkPosterHero>

    <!-- Synopsis -->
    <section v-if="hasValue(overview)" class="mt-5">
      <SectionHeader title="Synopsis" />
      <WorkDescription :key="movie.id" :overview="overview" />
    </section>

    <CastList :actors="movieData?.actors" class="mt-6" />

    <!-- Details: factual metadata and availability -->
    <section v-if="movieData || bookData" class="mt-6">
      <SectionHeader title="Details" />
      <div class="grid grid-cols-2 gap-x-4 gap-y-3">
        <MovieMetadataGrid
          v-if="movieData"
          :release-date="movieData.release_date"
          :directors="movieData.directors"
          :vote-average="movieData.vote_average"
        />
        <BookMetadataGrid
          v-else-if="bookData"
          :first-publish-year="bookData.firstPublishYear"
          :subjects="bookData.subjects"
        />
      </div>
      <WatchProviders
        v-if="movieData"
        :external-id="movie.externalId"
        class="mt-4"
      />
    </section>

    <CommentThread :work-id="movie.id" :club-slug="clubSlug" />

    <!-- Sticky action footer -->
    <div
      class="sticky bottom-0 -mx-4 mt-6 space-y-2 border-t border-gray-700/60 bg-background px-4 pb-2 pt-3"
    >
      <div class="flex w-full flex-wrap gap-3">
        <button
          v-if="canReview"
          class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/20 py-3 text-primary"
          @click="emit('review')"
        >
          <mdicon name="check" />
          <span>Reviewed</span>
        </button>
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/20 py-3 text-primary"
          @click="toggleNextWork"
        >
          <mdicon
            :name="isNextWork ? 'arrow-collapse-down' : 'arrow-collapse-up'"
          />
          <span>{{ isNextWork ? "Unpin" : "Up Next" }}</span>
        </button>
        <button
          class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500/20 py-3 text-red-500"
          @click="showDeleteConfirmation = true"
        >
          <mdicon name="delete" />
          <span>Delete</span>
        </button>
      </div>

      <Listbox
        v-if="otherLists.length > 0"
        v-model="moveToValue"
        @update:model-value="onMoveSelect"
      >
        <div class="relative">
          <ListboxButton
            class="flex w-full items-center justify-between rounded-lg bg-lowBackground px-4 py-2.5 text-sm text-gray-300"
          >
            <span>Move to…</span>
            <mdicon name="chevron-down" />
          </ListboxButton>
          <ListboxOptions
            class="absolute bottom-full left-0 z-10 mb-1 w-full rounded-lg border border-gray-700 bg-background py-1 shadow-lg focus:outline-none"
          >
            <ListboxOption
              v-for="list in otherLists"
              :key="list.id"
              :value="list.id"
              class="cursor-pointer px-4 py-2 text-sm hover:bg-lowBackground"
            >
              {{ list.title }}
            </ListboxOption>
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { DateTime } from "luxon";
import { computed, nextTick, ref } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedWorkListItem } from "../../../../lib/types/lists";

import BookMetadataGrid from "@/common/components/BookMetadataGrid.vue";
import CastList from "@/common/components/CastList.vue";
import CommentThread from "@/common/components/CommentThread.vue";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import MovieMetadataGrid from "@/common/components/MovieMetadataGrid.vue";
import SectionHeader from "@/common/components/SectionHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import WatchProviders from "@/common/components/WatchProviders.vue";
import WorkDescription from "@/common/components/WorkDescription.vue";
import WorkPosterHero from "@/common/components/WorkPosterHero.vue";
import {
  asBook,
  asMovie,
  workMetaLine,
  workPosterUrl,
  workSubtitle,
} from "@/common/workDisplay";

const props = defineProps<{
  movie: DetailedWorkListItem;
  clubSlug: string;
  isNextWork: boolean;
  isDesktop: boolean;
  canReview: boolean;
  otherLists: { id: string; title: string }[];
  addedByMember?: Member;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "review"): void;
  (e: "set-next-work"): void;
  (e: "clear-next-work"): void;
  (e: "delete"): void;
  (e: "move-to-list", listId: string): void;
}>();

const showDeleteConfirmation = ref(false);

const confirmDelete = () => {
  showDeleteConfirmation.value = false;
  emit("delete");
};

const toggleNextWork = () => {
  if (props.isNextWork) {
    emit("clear-next-work");
  } else {
    emit("set-next-work");
  }
};

const moveToValue = ref<string | null>(null);
const onMoveSelect = async (value: string | null) => {
  if (hasValue(value)) {
    emit("move-to-list", value);
  }
  await nextTick();
  moveToValue.value = null;
};

const formatDate = (dateString: string) => {
  return DateTime.fromISO(dateString).toLocaleString(DateTime.DATE_MED);
};

const movieData = computed(() => asMovie(props.movie.externalData));
const bookData = computed(() => asBook(props.movie.externalData));

// Cover/poster and year are sourced per media type; workPosterUrl prefers the
// movie's TMDB poster and falls back to the work's stored imageUrl (book cover).
const posterUrl = computed(() =>
  workPosterUrl(props.movie.externalData, props.movie.imageUrl),
);

// Release year (movies) or first-published year (books), via the shared helper.
const displayYear = computed(() => workSubtitle(props.movie.externalData));

// "2h 35m · Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages"
// (books), shown in the hero under the title. Runtime and genres live here, so
// the Details section below only carries what the hero doesn't.
const metaLine = computed(() => workMetaLine(props.movie.externalData));

const overview = computed(
  () => movieData.value?.overview ?? bookData.value?.description,
);
</script>
