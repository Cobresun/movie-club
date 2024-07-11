<template>
  <table class="w-full border-separate border-spacing-y-3">
    <thead>
      <tr
        v-for="headerGroup in reviewTable.getHeaderGroups()"
        :key="headerGroup.id"
      >
        <th
          v-for="header in headerGroup.headers"
          :key="header.id"
          class="sticky top-0 bg-secondary py-2 first:rounded-tl-xl last:rounded-tr-xl"
        >
          <div class="grid grid-cols-centerHeader items-center gap-x-1">
            <div class="col-start-2">
              <FlexRender
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </div>
            <mdicon
              v-if="header.column.getCanSort()"
              class="cursor-pointer"
              :name="
                header.column.getIsSorted()
                  ? header.column.getIsSorted() === 'desc'
                    ? 'arrow-down-drop-circle'
                    : 'arrow-up-drop-circle'
                  : 'menu-down'
              "
              @click="header.column.toggleSorting()"
            />
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in reviewTable.getRowModel().rows"
        :key="row.id"
        class="h-20 bg-lowBackground"
      >
        <td
          v-for="cell in row.getVisibleCells()"
          :key="cell.id"
          :class="`first:rounded-l-xl last:rounded-r-xl ${cell.column.columnDef.meta?.class ?? ''}`"
        >
          <FlexRender
            :render="cell.column.columnDef.cell"
            :props="cell.getContext()"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import {
  createColumnHelper,
  useVueTable,
  getCoreRowModel,
  FlexRender,
  getSortedRowModel,
} from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { computed, h } from "vue";

import ReviewScore from "./ReviewScore.vue";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import { Member } from "@/common/types/club";
import { DetailedReviewListItem } from "@/common/types/lists";

const { reviews, members } = defineProps<{
  reviews: DetailedReviewListItem[];
  members: Member[];
}>();

const columnHelper = createColumnHelper<DetailedReviewListItem>();

const columns = computed(() => [
  columnHelper.accessor("title", {
    header: "Title",
    meta: {
      class: "font-bold",
    },
  }),
  columnHelper.accessor("createdDate", {
    header: "Date Reviewed",
    cell: (info) => DateTime.fromISO(info.getValue()).toLocaleString(),
  }),
  ...members.map((member) =>
    columnHelper.accessor((row) => row.scores[member.id]?.score, {
      id: `member-${member.id}`,
      header: () =>
        h(VAvatar, {
          src: member.image,
          name: member.name,
        }),
      cell: (info) => {
        const value = info.getValue();
        const score =
          value === undefined ? undefined : Math.round(value * 100) / 100;
        return h(ReviewScore, {
          workId: info.row.original.id,
          memberId: member.id,
          score,
          reviewId: info.row.original.scores[member.id]?.id,
        });
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor((row) => row.scores.average?.score, {
    id: "score-average",
    header: () => h("img", { src: AverageImg, class: "w-16 h-12 max-w-none" }),
    cell: (info) => {
      const review = info.getValue();
      if (review === undefined) {
        return "";
      }
      return Math.round(review * 100) / 100;
    },
    sortUndefined: "last",
  }),
]);

const reviewTable = useVueTable({
  get columns() {
    return columns.value;
  },
  get data() {
    return reviews;
  },
  getCoreRowModel: getCoreRowModel<DetailedReviewListItem>(),
  getSortedRowModel: getSortedRowModel<DetailedReviewListItem>(),
});
</script>
