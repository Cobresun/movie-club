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
              <p class="px-3 py-1 text-left text-sm text-gray-400">
                Sort reviews by
              </p>
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
          <mdicon :name="sortState[0]?.desc ? 'chevron-down' : 'chevron-up'" />
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
          v-for="row in reviewTable.getRowModel().rows"
          :key="row.id"
          :data-movie-id="row.id"
          :title="row.renderValue('title')"
          :poster-url="row.renderValue('imageUrl')"
          :highlighted="selectedMovieId === row.id"
          class="transition-all duration-fast ease-standard md:cursor-pointer"
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
                  :props="{
                    ...cell.getContext(),
                    meta: { size: 'sm', editable: false, revealable: false },
                  }"
                />
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
      :review-table="reviewTable"
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
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { computed, ref, nextTick, watch } from "vue";

import WorkDetailsDrawer from "./WorkDetailsDrawer.vue";
import { isDefined } from "../../../../lib/checks/checks.js";
import { Member } from "../../../../lib/types/club";
import { DetailedReviewListItem } from "../../../../lib/types/lists";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";

const props = defineProps<{
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  members: Member[];
  revealedMovieIds: Set<string>;
  hasRated: (movieId: string) => boolean;
  currentUserId?: string;
}>();

const emit = defineEmits<{
  (e: "toggle-reveal", movieId: string): void;
}>();

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];
const NON_SORTABLE_COLUMNS = ["imageUrl", "title"];

const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    // First filter out custom rendered columns
    if (CUSTOM_RENDERED_COLUMNS.includes(cell.column.id)) {
      return false;
    }

    // Check if the cell has a value to not display empty chips. The current
    // user's own pill only appears once they have scored — entry happens in
    // the details drawer, not on the poster card.
    const value = cell.getValue();
    return value !== undefined && value !== null && value !== "";
  });
};

const getSortableColumns = () => {
  return props.reviewTable.getFlatHeaders().filter((header) => {
    return !NON_SORTABLE_COLUMNS.includes(header.id);
  });
};

// The raw column headers are avatars and images, so "sort by <avatar>" reads as
// meaningless to users. Map each sortable column to a plain-language descriptor
// ("Sarah's rating", "Average rating", "Date reviewed") the dropdown can spell
// out instead.
type SortOption =
  | { id: string; type: "member"; label: string; name: string; image?: string }
  | { id: string; type: "average"; label: string }
  | { id: string; type: "date"; label: string };

const sortOptions = computed<SortOption[]>(() =>
  getSortableColumns()
    .filter((header) => header.column.getCanSort())
    .map((header) => {
      const id = header.id;
      const member = props.members.find((m) => `member_${m.id}` === id);
      if (isDefined(member)) {
        return {
          id,
          type: "member",
          label: `${member.name}'s rating`,
          name: member.name,
          image: member.image,
        };
      }
      if (id === "score_average") {
        return { id, type: "average", label: "Average rating" };
      }
      return { id, type: "date", label: "Date reviewed" };
    }),
);

const activeSortOption = computed(() =>
  sortOptions.value.find((option) => option.id === sortState.value[0]?.id),
);

// Direction words depend on what's being sorted: dates read newest/oldest,
// ratings read highest/lowest. A bare up/down chevron didn't convey either.
const directionLabel = computed(() => {
  const sort = sortState.value[0];
  if (!isDefined(sort)) return "";
  if (activeSortOption.value?.type === "date") {
    return sort.desc ? "Newest first" : "Oldest first";
  }
  return sort.desc ? "Highest first" : "Lowest first";
});

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

const selectedMovieId = ref<string | undefined>(undefined);

const selectedMovie = computed(() => {
  if (selectedMovieId.value === undefined) return undefined;
  return props.reviewTable
    .getRowModel()
    .rows.find((row) => row.id === selectedMovieId.value);
});

const openMovieDetails = async (row: Row<DetailedReviewListItem>) => {
  if (selectedMovieId.value !== row.id) {
    selectedMovieId.value = row.id;

    await nextTick();
    // Find the clicked movie element and scroll to center it on page
    const clickedElement = document.querySelector(
      `[data-movie-id="${row.id}"]`,
    );

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
    const selectedElement = document.querySelector(
      `[data-movie-id="${oldValue}"]`,
    );
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
