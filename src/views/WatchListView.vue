<template>
  <div>
    <h1>Cobresun Watch List</h1>
    <movie-table
      :headers="headers"
      :data="tableData"
    >
    <template v-slot:movieTitle>
        <btn>
          Add Movie
          <mdicon name="plus"/>
        </btn>
      </template>
      <template v-slot:dateAdded>
        <btn>
          Shuffle
          <mdicon name="shuffle-variant"/>
        </btn>
      </template>
      <template v-slot:item-addedBy="slotProps">
         <avatar :fullname="slotProps.item[slotProps.head.value]"></avatar>
      </template>
    </movie-table>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { WatchListResponse, Header } from '@/models';
import axios from 'axios'

@Component({})
export default class WatchListView extends Vue {
  private watchList: WatchListResponse[] = [];
  private headers: Header[] = [
      {value: "movieTitle", style:"font-weight: 700", sortable: false, centerHeader: false},
      {value: "dateAdded", sortable: false},
      {value: "addedBy", sortable: false, includeHeader: false}];

  mounted(): void {
    axios
      .get('/api/getWatchList')
      .then((response) => (this.watchList = response.data))
  }

  get tableData(): any[] {
    const data: any[] = [];
    for (let i = 0; i < this.watchList.length; i++) {
      const obj: any = {};
      obj.movieTitle = this.watchList[i].movieTitle;
      obj.dateAdded = this.watchList[i].dateAdded['@date'];
      obj.addedBy = this.watchList[i].addedBy;
      data[i] = obj;
    }
    console.log(data);
    return data;
  }
}
</script>

<style scoped>
</style>
