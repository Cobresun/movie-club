<template>
  <div class="md:px-6">
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
import { FlexRender, Row, Table } from "@tanstack/vue-table";

import MoviePosterCard from "@/common/components/MoviePosterCard.vue";
import { DetailedReviewListItem } from "@/common/types/lists";

defineProps<{
  reviewTable: Table<DetailedReviewListItem>;
}>();

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];
const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    return !CUSTOM_RENDERED_COLUMNS.includes(cell.column.id);
  });
};

const getCell = (row: Row<DetailedReviewListItem>, columnId: string) => {
  return row.getVisibleCells().find((cell) => cell.column.id === columnId);
};
</script>
