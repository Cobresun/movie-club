<template>
  <div>
    <h1>Cobresun Reviews</h1>
    <div>
      <li v-for="review in reviews" :key="review">
        {{ review.data.movieTitle }} - {{ review.data.scores }}
      </li>
    </div>

  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import axios from 'axios'

@Component({})
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
