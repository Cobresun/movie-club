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
              {{ head.value }}
            </slot>
          </div>
          <div v-if="head.sortable" @click="sort(head.value)">
            <mdicon name="chevron-down" />
          </div>
        </div>
      </th>
    </thead>
    <tbody>
      <tr v-for="(item, index) in tableData" :key="index">
        <td class="item" v-for="(head, index) in tableHeaders" :key="index" :style="head.style">
          {{ item[head.value] }}
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

  private tableData: Record<string, any>[] = [];

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

  sort(value: string): void {
    this.tableData.sort((a, b) => a[value] - b[value]);
  }
}
</script>
<style scoped>
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
  margin: 20px auto;
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

tr {
  background-color: var(--primary-color);
  height: 75px;
  border-bottom: 10px solid transparent;
}

td {
  color: black;
}

tr td:first-child {
  border-top-left-radius: 10px;
  border-bottom-left-radius: 10px;
}

tr td:last-child {
  border-top-right-radius: 10px;
  border-bottom-right-radius: 10px;
}
</style>