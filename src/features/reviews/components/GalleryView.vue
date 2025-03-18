<template>
  <div class="flex transition-all duration-300">
    <!-- Main content that will shrink -->
    <div
      :class="[
        'w-full transition-all duration-300',
        { 'md:pr-[35vw]': isDrawerOpen },
      ]"
      class="md:px-6"
    >
      <div class="relative mb-4 flex w-min gap-2">
        <Listbox v-model="selectedSort">
          <ListboxButton
            class="flex items-center whitespace-nowrap rounded-full border border-white px-4 py-1"
            ><span>Sort By</span><mdicon name="chevron-down"
          /></ListboxButton>
          <ListboxOptions
            class="absolute z-10 rounded-md border border-white bg-background"
          >
            <ListboxOption
              v-for="header in getSortableColumns()"
              :key="header.id"
              :value="header.id"
              class="min-w-32 cursor-pointer px-2 py-1 text-left hover:bg-lowBackground"
            >
              <FlexRender
                :render="header.column.columnDef.header"
                :props="{
                  ...header.getContext(),
                  meta: { size: 'sm', showName: true },
                }"
              />
            </ListboxOption>
          </ListboxOptions>
        </Listbox>

        <div
          v-if="sortState[0]"
          class="flex items-center whitespace-nowrap rounded-full border border-white px-4 py-1"
        >
          <FlexRender
            :render="reviewTable.getColumn(sortState[0].id)?.columnDef.header"
            :props="{ meta: { showName: true, size: 'sm' } }"
          />
          <mdicon
            :name="sortState[0].desc ? 'chevron-down' : 'chevron-up'"
            class="ml-2 cursor-pointer"
            @click="reverseSort"
          />
        </div>
        <div
          v-if="sortState[0]"
          class="flex cursor-pointer items-center whitespace-nowrap rounded-full border border-white px-4 py-1"
          @click="selectedSort = undefined"
        >
          Clear
          <mdicon name="close" />
        </div>
      </div>

      <transition-group
        tag="div"
        leave-active-class="absolute hidden"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
        class="grid w-full justify-items-center pl-5"
        style="grid-template-columns: repeat(auto-fill, 168px)"
      >
        <MoviePosterCard
          v-for="row in reviewTable.getRowModel().rows"
          :key="row.id"
          :movie-title="row.renderValue('title')"
          :movie-poster-url="row.renderValue('imageUrl')"
          class="ease transition-all duration-500 md:cursor-pointer"
          @click="openMovieDetails(row)"
        >
          <div class="mb-2 text-sm text-gray-400">
            <FlexRender
              :render="reviewTable.getColumn('createdDate')?.columnDef.cell"
              :props="getCell(row, 'createdDate')?.getContext()"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="cell in getVisibleCells(row)"
              :key="cell.id"
              class="flex items-center rounded-3xl bg-slate-600"
            >
              <FlexRender
                :render="cell.column.columnDef.header"
                :props="{ ...cell.getContext(), meta: { size: 'sm' } }"
              />
              <div class="flex-grow text-sm">
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="{ ...cell.getContext(), meta: { size: 'sm' } }"
                />
              </div>
            </div>
          </div>
        </MoviePosterCard>
      </transition-group>
    </div>

    <!-- Movie Details Drawer -->
    <MovieDetailsDrawer
      v-model:is-open="isDrawerOpen"
      :movie="selectedMovie"
      :review-table="reviewTable"
      :delete-review="deleteReview"
      :revealed-movie-ids="revealedMovieIds"
      :has-rated="hasRated"
      :current-user-id="currentUserId"
      :blur-scores-enabled="blurScoresEnabled"
      @toggle-reveal="toggleMovieReveal"
    />
  </div>
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { computed, ref } from "vue";

import MovieDetailsDrawer from "./MovieDetailsDrawer.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";

const props = defineProps<{
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
  blurScoresEnabled: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", movieId: string): void;
}>();

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];
const NON_SORTABLE_COLUMNS = ["imageUrl"];

const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    // First filter out custom rendered columns
    if (CUSTOM_RENDERED_COLUMNS.includes(cell.column.id)) {
      return false;
    }

    // Check if the cell has a value to not display empty chips
    const value = cell.getValue();
    return value !== undefined && value !== null && value !== "";
  });
};

const getSortableColumns = () => {
  return props.reviewTable.getFlatHeaders().filter((header) => {
    return !NON_SORTABLE_COLUMNS.includes(header.id);
  });
};

const getCell = (row: Row<DetailedReviewListItem>, columnId: string) => {
  return row.getVisibleCells().find((cell) => cell.column.id === columnId);
};

const reverseSort = () => {
  const currentSort = sortState.value[0];
  if (!isDefined(currentSort)) {
    return;
  }
  props.reviewTable.setSorting([
    {
      id: currentSort.id,
      desc: !currentSort.desc,
    },
  ]);
};

const sortState = computed(() => props.reviewTable.getState().sorting);

const selectedSort = computed<string | undefined>({
  get: () => sortState.value[0]?.id,
  set: (value: string | undefined) => {
    if (!isDefined(value)) {
      props.reviewTable.setSorting([]);
      return;
    }
    props.reviewTable.setSorting([
      {
        id: value,
        desc: true,
      },
    ]);
  },
});

const selectedMovie = ref<Row<DetailedReviewListItem> | null>(null);
const isDrawerOpen = ref(false);

const openMovieDetails = (row: Row<DetailedReviewListItem>) => {
  selectedMovie.value = row;
  isDrawerOpen.value = true;
};

const toggleMovieReveal = (movieId: string) => {
  emit("toggle-reveal", movieId);
};
</script>
