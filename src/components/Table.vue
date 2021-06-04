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
        :class="{ selectable: selectable, highlighted: item.highlighted }" 
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

  // For debugging in v-for loops https://stackoverflow.com/a/54077708
  log(item: any) {
    console.log(item);
  }

  sort(value: string): void {
    if (this.sortBy[value] === 0) {
      for (const col of Object.keys(this.sortBy)) {
        this.sortBy[col] = 0;
      }
      this.tableData.sort((a, b) => {
        if (typeof a[value] === "number") {
          return a[value] - b[value];
        }
        if (!isNaN(Date.parse(a[value]))) {
          return Date.parse(a[value]) - Date.parse(b[value]);
        }
        return a[value].localeCompare(b[value]);
      });
      this.sortBy[value]++;
    } else if (this.sortBy[value] === 1) {
      this.tableData.sort((a, b) => {
        console.log(typeof b[value])
        if (typeof b[value] === "number") {
          return b[value] - a[value];
        }
        if (!isNaN(Date.parse(b[value]))) {
          return Date.parse(b[value]) - Date.parse(a[value]);
        }
        return b[value].localeCompare(a[value]);
      });
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

.highlighted {
  background-color: var(--highlight-background-color);
  cursor: pointer;
  filter: brightness(105%);
}

table thead th {
  position: sticky;
  position: -webkit-sticky;
  top: 0;
  z-index: 1;
}

table thead th:first-child {
  position: sticky;
  z-index: 2;
  left: 0;
}

table tbody th {
  position: sticky;
  z-index: 1;
  left: 0
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