<template>
  <div>
    <div class="title">
      <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
      <h1>Cobresun Reviews</h1>
    </div>
    
    <loading-spinner v-if="loading"/>

    <div v-if="!loading">
      <btn class="button">
        Add Review
        <mdicon name="plus"/>
      </btn>
      <movie-table
        :headers="headers"
        :data="tableData"
        v-if="reviews.length > 0"
      >
        <template v-for="(value, name) in reviews[0].scores" v-slot:[name]>
          <img v-if="name === 'average' " :key="name" src="@/assets/average.svg" width="64" height="48" />
          <avatar v-else :key="name" :fullname="name"></avatar>
        </template>
      </movie-table>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ReviewResponse, Header } from '@/models';
import axios from 'axios'

@Component({})
export default class ReviewView extends Vue {
  private reviews: ReviewResponse[] = [];
  private loading = false;

  mounted(): void {
    this.loading = true;
    axios
      .get('/api/getReviews')
      .then((response) => {
        this.loading = false;
        (this.reviews = response.data);
      })
  }

  get tableData(): any[] {
    const data: any[] = [];
    for (let i = 0; i < this.reviews.length; i++) {
      const obj: any = {};
      obj.movieTitle = this.reviews[i].movieTitle;
      obj.dateWatched = this.reviews[i].dateWatched['@date'];
      for (const key of Object.keys(this.reviews[i].scores)) {
        obj[key] = (this.reviews[i].scores as any)[key]; 
      }
      data[i] = obj;
    }
    return data;
  }

  get headers(): Header[] {
    const headers: Header[] = [
      {value: "movieTitle", style:"font-weight: 700", title:"Title"},
      {value: "dateWatched", title:"Date Reviewed"}];

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

.button {
  float: left;
}
</style>
