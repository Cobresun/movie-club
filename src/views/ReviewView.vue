<template>
  <div>
    <h1>Cobresun Reviews</h1>
    <movie-table
      :headers="headers"
      :data="tableData"
      v-if="reviews.length > 0"
    >
      <template v-slot:movieTitle>
        <btn>
          Add Review
          <mdicon name="plus"/>
        </btn>
      </template>
      <template v-for="(value, name) in reviews[0].scores" v-slot:[name]>
        <avatar :key="name" :fullname="name"></avatar>
      </template>
    </movie-table>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ReviewResponse, Header } from '@/models';
import axios from 'axios'

@Component({})
export default class ReviewView extends Vue {
  private reviews: ReviewResponse[] = [];

  mounted(): void {
    axios
      .get('/api/getReviews')
      .then((response) => (this.reviews = response.data))
  }

  get tableData(): any[] {
    const data: any[] = [];
    for (let i = 0; i < this.reviews.length; i++) {
      const obj: any = {};
      obj.movieTitle = this.reviews[i].movieTitle;
      obj.dateWatched = this.reviews[i].dateWatched;
      for (const key of Object.keys(this.reviews[i].scores)) {
        obj[key] = (this.reviews[i].scores as any)[key]; 
      }
      data[i] = obj;
    }
    return data;
  }

  get headers(): Header[] {
    const headers: Header[] = [
      {value: "movieTitle", style:"font-weight: 700", sortable: false, centerHeader: false},
      {value: "dateWatched", title:"Date Reviewed", sortable: true}];

    if (this.reviews.length > 0) {
      for (const key of Object.keys(this.reviews[0].scores)) {
        headers.push({value:key});
      }
    }
    return headers;
  }
}
</script>

<style scoped>
</style>
