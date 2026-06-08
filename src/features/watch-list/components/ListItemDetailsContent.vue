<template>
  <div class="flex-grow text-left">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirmation = false"
    />

    <MoviePosterHero
      :poster-path="movie.externalData?.poster_path"
      :backdrop-path="movie.externalData?.backdrop_path"
      :title="movie.title"
      :year="releaseYear"
      :date-label="formatDate(movie.createdDate)"
      :is-desktop="isDesktop"
    />

    <div class="grid grid-cols-1 gap-y-2 text-sm md:grid-cols-2 md:gap-x-4">
      <MovieMetadataGrid
        :release-date="movie.externalData?.release_date"
        :runtime="movie.externalData?.runtime"
        :genres="movie.externalData?.genres"
        :directors="movie.externalData?.directors"
        :actors="movie.externalData?.actors"
        :vote-average="movie.externalData?.vote_average"
      />
      <WatchProviders :external-id="movie.externalId" class="md:col-span-2" />
    </div>

    <div v-if="movie.externalData?.overview" class="mt-4">
      <MovieDescription
        :key="movie.id"
        :overview="movie.externalData.overview"
      />
    </div>

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

import { hasValue } from "../../../../lib/checks/checks.js";
import { DetailedWorkListItem } from "../../../../lib/types/lists.js";

import CommentThread from "@/common/components/CommentThread.vue";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import MovieDescription from "@/common/components/MovieDescription.vue";
import MovieMetadataGrid from "@/common/components/MovieMetadataGrid.vue";
import MoviePosterHero from "@/common/components/MoviePosterHero.vue";
import WatchProviders from "@/common/components/WatchProviders.vue";

const props = defineProps<{
  movie: DetailedWorkListItem;
  clubSlug: string;
  isNextWork: boolean;
  isDesktop: boolean;
  canReview: boolean;
  otherLists: { id: string; title: string }[];
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

const releaseYear = computed(() => {
  const releaseDate = props.movie.externalData?.release_date;
  if (!hasValue(releaseDate)) return undefined;
  const year = DateTime.fromISO(releaseDate).year;
  return Number.isNaN(year) ? undefined : year;
});
</script>
