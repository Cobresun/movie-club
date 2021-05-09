<template>
  <div>
    <div class="title">
      <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
      <h1>Cobresun Watch List</h1>
    </div>
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
.title {
  display: grid;
  grid-column-gap: 32px;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
}

.title:first-child {
  justify-items: right;
}

.back {
  color: var(--text-color);
}

.back:hover {
  cursor: pointer;
}
</style>
