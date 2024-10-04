<template>
  <div class="md:px-6">
    <div class="relative mb-4 flex w-min gap-2">
      <Listbox v-model="selectedSort">
        <ListboxButton
          class="flex items-center whitespace-nowrap rounded-full border border-white px-4 py-1"
          ><span>Sort By</span><mdicon name="chevron-down"
        /></ListboxButton>
        <ListboxOptions
          class="absolute z-10 rounded-md border border-white bg-background p-2"
        >
          <ListboxOption
            v-for="header in getSortableColumns()"
            :key="header.id"
            :value="header.id"
            class="min-w-32 cursor-pointer text-left"
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
      class="grid grid-cols-auto justify-items-center"
    >
      <MoviePosterCard
        v-for="row in reviewTable.getRowModel().rows"
        :key="row.id"
        :movie-title="row.renderValue('title')"
        :movie-poster-url="row.renderValue('imageUrl')"
        class="ease transition-all duration-500"
        show-delete
        @delete="deleteReview(row.original.id)"
      >
        <div class="mb-2 text-sm">
          <FlexRender
            :render="reviewTable.getColumn('createdDate')?.columnDef.cell"
            :props="getCell(row, 'createdDate')?.getContext()"
          />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="cell in getVisibleCells(row)"
            :key="cell.id"
            class="flex items-center rounded-3xl bg-lowBackground"
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
</template>

<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { FlexRender, Row, Table } from "@tanstack/vue-table";
import { computed } from "vue";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { Member } from "@/common/types/club";
import { DetailedReviewListItem } from "@/common/types/lists";

const props = defineProps<{
  reviewTable: Table<DetailedReviewListItem>;
  deleteReview: (workId: string) => void;
  members: Member[];
}>();

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];
const NON_SORTABLE_COLUMNS = ["imageUrl"];

const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    return !CUSTOM_RENDERED_COLUMNS.includes(cell.column.id);
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
  if (!currentSort) {
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
    if (!value) {
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
</script>
