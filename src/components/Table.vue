<template>
  <table>
    <tbody>
      <tr v-for="(item, index) in data" :key="index">
        <td class="item" v-for="(head, index) in headers" :key="index" :style="head.style">
          {{ item[head.value] }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { Header } from '@/models'

@Component({})
export default class Table extends Vue {
  @Prop() headers!: Header[];
  @Prop() data!: Record<string, unknown>[];
  //TODO Headers and sorting
}
</script>
<style scoped>
table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 10px;
  margin: 20px auto;
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