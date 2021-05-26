<template>
  <div>
    <add-review-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="title">
        <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
        <h1>Cobresun Reviews</h1>
      </div>
      <loading-spinner v-if="loading"/>
      <div v-else>
        <btn 
          class="button"
          @click="openPrompt()">
          Add Review
          <mdicon name="plus"/>
        </btn>
        <movie-table
          :headers="headers"
          :data="tableData"
          v-if="reviews.length > 0"
        >
          <template v-for="name in members" v-slot:[name]>
            <avatar :key="name" :fullname="name"></avatar>
          </template>
          <template v-slot:average>
            <img src="@/assets/average.svg" width="64" height="48" />
          </template>
        </movie-table>
      </div>
    </div> 
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ReviewResponse, Header } from '@/models';
import AddReviewPrompt from '@/components/SearchPrompt/AddReviewPrompt.vue';
import axios from 'axios'

@Component({
  components: { AddReviewPrompt },
})
export default class ReviewView extends Vue {
  private reviews: ReviewResponse[] = [];
  private members: string[] = [];
  private loadingReviews = false;
  private loadingMembers = false;

  private modalOpen = false;

  mounted(): void {
    this.loadingReviews = true;
    axios
      .get('/api/getReviews')
      .then((response) => {
        this.loadingReviews = false;
        (this.reviews = response.data);
      })
    this.loadingMembers = true;
    axios
      .get('/api/club/8/members')
      .then((response) => {
        this.loadingMembers = false;
        this.members = response.data;
      })
  }

  get loading(): boolean {
    return this.loadingReviews || this.loadingMembers;
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

    if (this.members.length > 0) {
      for (const member of this.members) {
        headers.push({value:member});
      }
    }
    headers.push({value: "average"});
    return headers;
  }

  openPrompt(): void {
    this.modalOpen = true;
  }

  closePrompt(reviewAdded: boolean, newReview: ReviewResponse): void {
    this.modalOpen = false;
    if (reviewAdded) {
      this.reviews.unshift(newReview);
    }
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
