<template>
  <div class="flex-grow">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      @confirm="confirmDelete"
      @cancel="showDeleteConfirmation = false"
    />

    <!-- Desktop layout -->
    <template v-if="isDesktop">
      <div class="flex flex-col items-center">
        <img
          :src="`https://image.tmdb.org/t/p/w500/${movie.externalData?.poster_path}`"
          class="mb-8 w-1/2 rounded-lg"
          alt="Movie poster"
        />
        <div class="flex w-full flex-col items-center">
          <h2 class="text-center text-xl font-bold">
            {{ movie.title }}
          </h2>
          <div class="mt-2 text-center text-sm text-gray-400">
            {{ formatDate(movie.createdDate) }}
          </div>
          <div
            class="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm md:grid-cols-2"
          >
            <MovieMetadataGrid
              :release-date="movie.externalData?.release_date"
              :runtime="movie.externalData?.runtime"
              :genres="movie.externalData?.genres"
              :directors="movie.externalData?.directors"
              :actors="movie.externalData?.actors"
              :vote-average="movie.externalData?.vote_average"
            />
          </div>
        </div>
      </div>

      <div v-if="movie.externalData" class="mt-6">
        <MovieDescription
          v-if="movie.externalData.overview"
          :key="movie.id"
          :overview="movie.externalData.overview"
        />
      </div>
    </template>

    <!-- Mobile layout -->
    <template v-else>
      <div class="flex gap-4">
        <img
          :src="`https://image.tmdb.org/t/p/w500/${movie.externalData?.poster_path}`"
          class="w-20 flex-shrink-0 rounded-lg object-cover"
          :style="{ aspectRatio: '2/3' }"
          alt="Movie poster"
        />
        <div class="flex flex-col justify-center">
          <h2 class="text-xl font-bold">
            {{ movie.title }}
          </h2>
          <div class="mt-1 text-sm text-gray-400">
            {{ formatDate(movie.createdDate) }}
          </div>
        </div>
      </div>

      <Disclosure v-slot="{ open }">
        <DisclosureButton
          class="mt-4 flex w-full items-center justify-between rounded-lg bg-lowBackground px-4 py-2.5 text-sm font-medium text-gray-300"
        >
          <span>Movie Details</span>
          <mdicon
            name="chevron-down"
            :class="open ? 'rotate-180 transform' : ''"
            class="transition-transform duration-200"
          />
        </DisclosureButton>
        <DisclosurePanel class="mt-2 grid grid-cols-1 gap-y-2 px-1 text-sm">
          <MovieMetadataGrid
            :release-date="movie.externalData?.release_date"
            :runtime="movie.externalData?.runtime"
            :genres="movie.externalData?.genres"
            :directors="movie.externalData?.directors"
            :actors="movie.externalData?.actors"
            :vote-average="movie.externalData?.vote_average"
          />
          <MovieDescription
            v-if="movie.externalData?.overview"
            :key="movie.id"
            :overview="movie.externalData.overview"
            class="mt-2"
          />
        </DisclosurePanel>
      </Disclosure>
    </template>

    <!-- Action buttons -->
    <div class="mt-6 flex w-full flex-wrap gap-3">
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

    <select
      v-if="otherLists.length > 0"
      class="mt-3 w-full rounded-md bg-slate-800 px-2 py-2 text-sm text-white"
      @change="onMoveSelect"
    >
      <option value="">Move to…</option>
      <option v-for="l in otherLists" :key="l.id" :value="l.id">
        {{ l.title }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
import { DateTime } from "luxon";
import { ref } from "vue";

import { DetailedWorkListItem } from "../../../../lib/types/lists";

import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import MovieDescription from "@/common/components/MovieDescription.vue";
import MovieMetadataGrid from "@/common/components/MovieMetadataGrid.vue";

const { isNextWork } = defineProps<{
  movie: DetailedWorkListItem;
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
  if (isNextWork) {
    emit("clear-next-work");
  } else {
    emit("set-next-work");
  }
};

const onMoveSelect = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  if (target.value === "") return;
  emit("move-to-list", target.value);
  target.value = "";
};

const formatDate = (dateString: string) => {
  return DateTime.fromISO(dateString).toLocaleString(DateTime.DATE_MED);
};
</script>
