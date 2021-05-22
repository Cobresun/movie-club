<template>
  <table>
    <thead v-if="header">
      <th v-for="head in tableHeaders" :key="head.value">
        <div 
          v-if="head.includeHeader"
          class="header-child" 
          v-bind:class="[ head.centerHeader? 'center-header' : 'left-header' ]" 
        >
          <div v-if="head.includeHeader">
            <slot :name="head.value">
              {{ head.title }}
            </slot>
          </div>
          <div class="sort-button" v-if="head.sortable" @click="sort(head.value)">
            <mdicon v-if="sortBy[head.value] === 0" name="menu-down" />
            <mdicon v-else-if="sortBy[head.value] === 1" name="arrow-down-drop-circle" />
            <mdicon v-else name="arrow-up-drop-circle" />
          </div>
        </div>
      </th>
    </thead>
    <tbody>
      <tr 
        v-for="(item, index) in tableData" 
        :key="index"
        :class="{ selectable: selectable }" 
        @click="$emit('clickRow', item)"
      >
        <td class="item" v-for="(head, index) in tableHeaders" :key="index" :style="head.style">
          <slot :name="'item-'+head.value" v-bind:item="item" v-bind:head="head">
            {{ item[head.value] }}
          </slot>
        </td>
      </tr>
    </tbody>
  </table>
</template>
<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import { Header } from '@/models'

@Component({})
export default class Table extends Vue {
  @Prop() headers!: Header[];
  @Prop() data!: Record<string, any>[];
  @Prop({default: true}) header!: boolean;
  @Prop({default: false}) selectable!: boolean;

  private tableData: Record<string, any>[] = [];
  private sortBy: Record<string, number> = {};

  get tableHeaders(): Header[] {
    const tableHeaders: Header[] = [];
    for (const header of this.headers) {
      if (header.sortable === undefined) {
        header.sortable = true;
      }
      if (header.includeHeader === undefined) {
        header.includeHeader = true;
      }
      if (header.centerHeader === undefined) {
        header.centerHeader = true;
      }
      tableHeaders.push(header);
    }
    return tableHeaders;
  }

  @Watch('data', {immediate: true})
  updateTableData(): void {
    this.tableData = this.data.slice(0);
  }

  @Watch('header', {immediate: true})
  updateSortBy(): void {
    for (const head of this.headers) {
      this.sortBy[head.value] = 0;
    }
  }

  sort(value: string): void {
    if (this.sortBy[value] === 0) {
      for (const col of Object.keys(this.sortBy)) {
        this.sortBy[col] = 0;
      }
      this.tableData.sort((a, b) => a[value] - b[value]);
      this.sortBy[value]++;
    } else if (this.sortBy[value] === 1) {
      this.tableData.sort((a, b) => b[value] - a[value]);
      this.sortBy[value]++;
    } else {
      this.updateTableData();
      this.sortBy[value] = 0;
    }
  }
}
</script>
<style scoped>
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
}

.header-child {
  display: grid;
  grid-column-gap: 5px;
  align-items: center;
}

.center-header {
  grid-template-columns: 1fr auto 1fr;
}

.left-header {
  grid-template-columns: auto 1fr;
}

.center-header div:nth-child(1) {
  grid-column-start: 2;
}

th {
  background-color: var(--secondary-color);
  padding-top: 7px;
}

th:first-child {
  border-top-left-radius: 10px;
}

th:last-child {
  border-top-right-radius: 10px;
}

tr {
  background-color: var(--low-key-background-color);
  height: 75px;
  border-bottom: 10px solid transparent;
}

td {
  color: var(--text-color);;
}

tr td:first-child {
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
}

tr td:last-child {
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
}

.sort-button {
  cursor: pointer;
}

.selectable:hover {
  cursor: pointer;
  filter: brightness(105%);
}
</style>