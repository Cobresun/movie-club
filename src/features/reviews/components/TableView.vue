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
          class="sticky top-0 bg-secondary p-2 first:rounded-tl-xl last:rounded-tr-xl"
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
          :class="`p-2 first:rounded-l-xl last:rounded-r-xl ${cell.column.columnDef.meta?.class ?? ''}`"
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
import { FlexRender, Table } from "@tanstack/vue-table";

import { DetailedReviewListItem } from "@/common/types/lists";

defineProps<{
  reviewTable: Table<DetailedReviewListItem>;
}>();
</script>
