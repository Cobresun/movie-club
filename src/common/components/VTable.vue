<template>
  <table
    class="w-full border-separate"
    style="border-spacing: 0 10px"
  >
    <thead v-if="header">
      <th
        v-for="head in tableHeaders"
        :key="head.value"
        class="sticky top-0 bg-secondary py-2 first:rounded-tl-xl last:rounded-tr-xl"
      >
        <div 
          v-if="head.includeHeader"
          class="grid gap-x-1 items-center " 
          :class="[ head.centerHeader? 'grid-cols-centerHeader' : 'grid-cols-leftHeader' ]" 
        >
          <div
            v-if="head.includeHeader"
            :class="{'col-start-2':head.centerHeader}"
          >
            <slot :name="head.value">
              {{ head.title }}
            </slot>
          </div>
          <div
            v-if="head.sortable"
            class="cursor-pointer"
            @click="sort(head.value)"
          >
            <mdicon
              v-if="!sortBy[head.value] || sortBy[head.value] === 0"
              name="menu-down"
            />
            <mdicon
              v-else-if="sortBy[head.value] === 1"
              name="arrow-down-drop-circle"
            />
            <mdicon
              v-else
              name="arrow-up-drop-circle"
            />
          </div>
        </div>
      </th>
    </thead>
    <tbody>
      <tr 
        v-for="(item, index) in tableData" 
        :key="index"
        class="filter bg-lowBackground h-20"
        :class="{ 'cursor-pointer hover:brightness-105': selectable }" 
        @click="emit('clickRow', item)"
      >
        <td
          v-for="(head, tdIndex) in tableHeaders"
          :key="tdIndex"
          class="first:rounded-l-xl last:rounded-r-xl"
          :class="[
            item.highlighted?'border-t-4 border-b-4 first:border-l-4 last:border-r-4 border-highlightBackground':'', 
            head.style? head.style:''
          ]"
        >
          <slot
            :name="'item-'+head.value"
            :item="item"
            :head="head"
          >
            {{ item[head.value] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

import { Header } from '@/common/types/models';

interface Props {
  headers: Header[];
  data: Record<string, unknown>[];
  header?: boolean;
  selectable?: boolean;
}

const { headers, data, header = true, selectable = false} = defineProps<Props>();

const emit = defineEmits<{
  (e: 'clickRow', item: Record<string, unknown>): void
}>();

const tableHeaders = computed(() => {
  const tableHeaders: Header[] = [];

  for (const itemHeader of headers) {
    if (itemHeader.sortable === undefined) {
      itemHeader.sortable = true;
    }
    if (itemHeader.includeHeader === undefined) {
      itemHeader.includeHeader = true;
    }
    if (itemHeader.centerHeader === undefined) {
      itemHeader.centerHeader = true;
    }
    tableHeaders.push(itemHeader);
  }
  return tableHeaders;
})

const tableData = ref(data.slice(0));

const updateTableData = () => { tableData.value = data.slice(0) }
watch(() => data, updateTableData);

const comparator = (value: string, order: boolean) => { 
  const comp = (a: Record<string, unknown>, b:Record<string, unknown>) => {
    const aVal = a[value];
    const bVal = b[value];
    if (aVal === undefined) { return 1; }
    if (bVal === undefined) { return -1; }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return aVal - bVal;
    }
    if (typeof aVal === "string" &&  typeof bVal === 'string' && !isNaN(Date.parse(aVal))) {
      return Date.parse(aVal) - Date.parse(bVal);
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal);
    }
    return 0;
  }
  return order ? comp : (a:Record<string, unknown>,b:Record<string,unknown>) => {
    if (a[value] === undefined || b[value] === undefined) { return comp(a,b) }
    return comp(b,a)
  }
}

const sortBy = ref<Record<string, number>>({});
const sort = (value: string) => {
  if (!sortBy.value[value]) {
    sortBy.value[value] = 0;
  }
  if (sortBy.value[value] === 0) {
    for (const col of Object.keys(sortBy.value)) {
      sortBy.value[col] = 0;
    }
    const comp = comparator(value, true);
    tableData.value.sort(comp);
    sortBy.value[value]++;
  } else if (sortBy.value[value] === 1) {
    const comp = comparator(value, false);
    tableData.value.sort(comp);
    sortBy.value[value]++;
  } else {
    updateTableData();
    sortBy.value[value] = 0;
  }
};

</script>