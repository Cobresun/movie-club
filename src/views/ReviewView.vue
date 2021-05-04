<template>
  <div>
    <h1>Cobresun Reviews</h1>
    <div>
      <li v-for="review in reviews" :key="review">
        {{ review.movieTitle }} - {{ review.scores }}
      </li>
    </div>

  </div>
</template>

<script lang="ts">
import { Vue } from 'vue-class-component';
import axios from 'axios'

export default class ReviewView extends Vue {
  private reviews = null;

  mounted(): void {
    axios
      .get('/api/getReviews')
      .then((response) => (this.reviews = response.data))
  }
}
</script>

<style scoped>
</style>
