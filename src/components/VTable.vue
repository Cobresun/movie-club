<!-- <template>
  <table class="w-full border-separate" style="border-spacing: 0 10px">
    <thead v-if="header">
      <th v-for="head in tableHeaders" :key="head.value" class="sticky top-0 bg-secondary pt-2 first:rounded-tl-xl last:rounded-tr-xl">
        <div 
          v-if="head.includeHeader"
          class="grid gap-x-1 items-center " 
          v-bind:class="[ head.centerHeader? 'grid-cols-centerHeader' : 'grid-cols-leftHeader' ]" 
        >
          <div :class="{'col-start-2':head.centerHeader}" v-if="head.includeHeader">
            <slot :name="head.value">
              {{ head.title }}
            </slot>
          </div>
          <div class="cursor-pointer" v-if="head.sortable" @click="sort(head.value)">
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
        class="filter bg-lowBackground h-20"
        :class="{ 'cursor-pointer hover:brightness-105': selectable }" 
        @click="$emit('clickRow', item)"
      >
        <td
          class="first:rounded-l-xl last:rounded-r-xl"
          :class="{'border-t-4 border-b-4 first:border-l-4 last:border-r-4 border-highlightBackground':item.highlighted, [head.style]:head.style}"
          v-for="(head, index) in tableHeaders" :key="index"
        >
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
      this.tableData.sort((a, b) => {
        if (a[value] === undefined) {
          return 1;
        }
        if (b[value] === undefined) {
          return -1;
        }
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
        if (a[value] === undefined) {
          return 1;
        }
        if (b[value] === undefined) {
          return -1;
        }
        if (typeof a[value] === "number") {
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
</script> -->