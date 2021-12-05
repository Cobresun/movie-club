<template>
  <div>
    <add-review-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="title">
        <router-link to="/clubHome"><mdicon class="back" name="arrow-left" size="40"/></router-link>
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
          <template v-for="member in members" v-slot:[member.name]>
            <avatar :key="member.name" :image="member.image"></avatar>
          </template>

          <template v-for="member in members" v-slot:[`item-${member.name}`]="slotProps">
            <div
              v-if="slotProps.item[member.name] === undefined" 
              :key="member.name"
            >
              <input
                class="score-input"
                :ref="'scoreInput' + slotProps.item.movieId + member.name"
                v-show="addScoreInput === slotProps.item.movieId + member.name"
                v-model="newScore"
                @keypress.enter="submitScore(slotProps.item.movieId, member.name)"
              />
              <div
                v-if="addScoreInput !== slotProps.item.movieId + member.name" 
                class="score-button"
                @click="openScoreInput(slotProps.item.movieId, member.name)"
              >
                <mdicon name="plus"/>
              </div>
            </div>
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
import { Component, Vue, Ref } from 'vue-property-decorator';
import { ReviewResponse, Member, Header } from '@/models';
import AddReviewPrompt from '@/components/SearchPrompt/AddReviewPrompt.vue';
import axios from 'axios'
import { DateTime } from "luxon";

@Component({
  components: { AddReviewPrompt },
})
export default class ReviewView extends Vue {
  private reviews: ReviewResponse[] = [];
  private members: Member[] = [];
  private loadingReviews = false;
  private loadingMembers = false;

  private addScoreInput = "";
  private newScore = "";
  @Ref() readonly scoreInput!: HTMLInputElement

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
      obj.dateWatched = DateTime.fromISO(this.reviews[i].timeWatched['@ts']).toLocaleString();  
      obj.movieId = this.reviews[i].movieId;
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
        headers.push({value: member.name});
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

  openScoreInput(movieId: number, user: string): void {
    this.newScore = "";
    this.addScoreInput = movieId + user;
    this.$nextTick(() => (this.$refs['scoreInput' + movieId + user] as HTMLInputElement[])[0].focus());
  }

  submitScore(movieId: number, user: string): void {
    let newScore = parseFloat(this.newScore);

    if (!isNaN(newScore) && newScore >= 0 && newScore <= 10) {
      axios
        .post(`/api/postReviewScore?movieId=${ movieId }&user=${ user }&score=${ newScore }`, {}, {
          headers: {
            Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
          }
        })
        .then(response => {
          let newReview = this.reviews.find(review => review.movieId === movieId)
          if (newReview !== undefined) {
            newReview.scores = response.data.scores
          }
        })
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

.score-button {
  cursor: pointer;
}

.score-input {
  background-color: var(--background-color);
  border-radius: 4px;
  border: none;
  padding: 0.5rem;
  color: white;
  width: 2rem;
}
</style>
