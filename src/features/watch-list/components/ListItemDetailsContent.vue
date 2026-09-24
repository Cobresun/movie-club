<template>
  <div class="flex-grow text-left">
    <delete-confirmation-modal
      :show="showDeleteConfirmation"
      title="Remove from list"
      :message="`Remove ${movie.title} from this list?`"
      confirm-label="Remove"
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
        <span v-if="isDefined(addedByMember)" class="inline-flex items-center gap-2">
          <VAvatar :src="addedByMember.image" :name="addedByMember.name" :size="20" />
          <span>
            Added by {{ addedByMember.name }} on
            {{ formatDate(movie.createdDate) }}
          </span>
        </span>
        <template v-else>Added {{ formatDate(movie.createdDate) }}</template>
      </template>
    </WorkPosterHero>

    <div class="-mt-2 flex flex-wrap gap-2">
      <Listbox
        v-if="otherLists.length > 0"
        v-model="moveToValue"
        @update:model-value="onMoveSelect"
      >
        <div class="relative">
          <ListboxButton
            class="flex items-center gap-1.5 rounded-full bg-lowBackground px-3 py-1.5 text-sm text-gray-200 transition hover:brightness-110"
          >
            <mdicon name="swap-horizontal" size="16" />
            <span>Move to list</span>
            <mdicon name="chevron-down" size="16" />
          </ListboxButton>
          <ListboxOptions
            class="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-gray-700 bg-background py-1 shadow-lg focus:outline-none"
          >
            <ListboxOption
              v-for="list in otherLists"
              :key="list.id"
              v-slot="{ active }"
              :value="list.id"
              as="template"
            >
              <li
                class="cursor-pointer truncate px-4 py-2 text-sm"
                :class="{ 'bg-lowBackground': active }"
              >
                {{ list.title }}
              </li>
            </ListboxOption>
          </ListboxOptions>
        </div>
      </Listbox>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10"
        @click="showDeleteConfirmation = true"
      >
        <mdicon name="delete-outline" size="16" />
        <span>Remove from list</span>
      </button>
    </div>

    <!-- Synopsis -->
    <section v-if="hasValue(overview)" class="mt-5">
      <SectionHeader title="Synopsis" />
      <WorkDescription :key="movie.id" :overview="overview" />
    </section>

    <CastList :actors="castActors" class="mt-6" />

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
      <WatchProviders v-if="movieData" :external-id="movie.externalId" class="mt-4" />
    </section>

    <CommentThread :work-id="movie.id" :club-slug="clubSlug" />

    <div
      class="sticky bottom-0 -mx-4 mt-6 border-t border-gray-700/60 bg-background px-4 pb-2 pt-3"
    >
      <div class="flex items-center gap-2">
        <button
          v-if="canReview"
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold tracking-wide text-text transition hover:brightness-110 active:scale-[0.98]"
          :aria-describedby="reviewHintId"
          @click="emit('review')"
        >
          <mdicon name="check" size="20" />
          <span>Mark as {{ finishedVerb }}</span>
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-lg py-3 font-bold tracking-wide transition hover:brightness-110 active:scale-[0.98]"
          :class="[
            canReview ? 'shrink-0 px-4' : 'flex-1',
            isNextWork ? 'bg-highlightBackground text-slate-900' : 'bg-lowBackground text-gray-200',
          ]"
          :aria-pressed="isNextWork"
          @click="toggleNextWork"
        >
          <mdicon :name="isNextWork ? 'pin' : 'pin-outline'" size="20" />
          <span>Up next</span>
        </button>
      </div>
      <p v-if="canReview" :id="reviewHintId" class="mt-2 text-center text-xs text-gray-400">
        Moves it to Reviews so the club can score it.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/vue";
import { computed, nextTick, ref, useId } from "vue";

import { hasValue, isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { ClubType } from "../../../../lib/types/generated/db";
import { DetailedWorkListItem } from "../../../../lib/types/lists";
import { clubTypeConfig, workMetaLine, workOverview, workSubtitle } from "@/common/clubType";
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
import { asBook, asMovie, formatDate, workPosterUrl } from "@/common/workDisplay";
import { useClub } from "@/service/useClub";
import { useWorkDetails } from "@/service/useList";

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

const { data: club } = useClub(props.clubSlug);
const finishedVerb = computed(
  () => clubTypeConfig(club.value?.type ?? ClubType.movie).finishedVerb,
);
const reviewHintId = useId();

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

const movieData = computed(() => asMovie(props.movie.externalData));
const bookData = computed(() => asBook(props.movie.externalData));

// Bulk list payloads carry only summary metadata; fetch the full cast on
// demand when this drawer opens (skipped for optimistic temp rows).
const { data: workDetails } = useWorkDetails(
  props.clubSlug,
  computed(() => props.movie.id),
);
const castActors = computed(() => asMovie(workDetails.value ?? undefined)?.actors);

// Cover/poster and year are sourced per media type; workPosterUrl prefers the
// movie's TMDB poster and falls back to the work's stored imageUrl (book cover).
const posterUrl = computed(() => workPosterUrl(props.movie.externalData, props.movie.imageUrl));

// Release year (movies) or first-published year (books), via the shared helper.
const displayYear = computed(() => workSubtitle(props.movie.externalData));

// "2h 35m · Adventure, Science Fiction" (movies) / "Frank Herbert · 412 pages"
// (books), shown in the hero under the title. Runtime and genres live here, so
// the Details section below only carries what the hero doesn't.
const metaLine = computed(() => workMetaLine(props.movie.externalData));

const overview = computed(() => workOverview(props.movie.externalData));
</script>
