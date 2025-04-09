<template>
  <div class="-mx-2 overflow-x-auto pb-2 md:px-2">
    <table class="w-full min-w-[640px] border-separate border-spacing-y-2">
      <thead>
        <tr
          v-for="headerGroup in reviewTable.getHeaderGroups()"
          :key="headerGroup.id"
        >
          <th
            v-for="header in headerGroup.headers"
            :key="header.id"
            class="sticky top-0 z-10 whitespace-nowrap bg-secondary p-2 text-left first:rounded-tl-xl last:rounded-tr-xl"
            :class="[
              header.column.columnDef.meta?.class ?? '',
              header.id === 'title' ? 'sticky left-0 z-20 max-w-[130px]' : '',
            ]"
          >
            <div class="grid grid-cols-centerHeader items-center md:gap-x-1">
              <div class="col-start-2 max-md:scale-90">
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
          class="group h-20 bg-lowBackground"
        >
          <td
            v-for="cell in row.getVisibleCells()"
            :key="cell.id"
            :class="[
              'p-2 first:rounded-l-xl last:rounded-r-xl',
              cell.column.columnDef.meta?.class ?? '',
              cell.column.id === 'title'
                ? 'sticky left-0 z-20 max-w-[185px] bg-lowBackground max-md:px-3 max-md:py-1'
                : '',
            ]"
          >
            <FlexRender
              :render="cell.column.columnDef.cell"
              :props="cell.getContext()"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts" generic="T extends DetailedReviewListItem">
import { FlexRender, Table } from "@tanstack/vue-table";

import { DetailedReviewListItem } from "../../../../lib/types/lists";

defineProps<{
  reviewTable: Table<T>;
}>();
</script>
