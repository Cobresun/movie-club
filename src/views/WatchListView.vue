<template>
  <div>
    <add-movie-to-watchlist-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="title">
        <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
        <h1>Cobresun Watch List</h1>
      </div>

      <loading-spinner v-if="loading"/>

      <div v-if="!loading">
        <btn class="button" @click="openPrompt">
          Add Movie
          <mdicon name="plus"/>
        </btn>

        <btn class="button" @click="selectRandom()">
          Random
          <mdicon name="dice-multiple-outline"/>
        </btn>

        <movie-table
          :header="false" 
          :headers="headers"
          :data="watchListTableData"
        >
          <template v-slot:movieTitle>
          </template>
          
          <template v-slot:dateAdded>
          </template>
          
          <template v-slot:item-addedBy="slotProps">
            <avatar :fullname="slotProps.item[slotProps.head.value]"></avatar>
          </template>

          <template v-slot:item-reviewMovie="slotProps">
            <btn @click="reviewMovie(slotProps.item[slotProps.head.value])">
              <mdicon name="check"/>
            </btn>
          </template>
        </movie-table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { WatchListResponse, Header, NextMovieResponse } from '@/models';
import axios from 'axios'
import AddMovieToWatchlistPrompt from '@/components/SearchPrompt/AddMovieToWatchlistPrompt.vue';

@Component({
  components: { AddMovieToWatchlistPrompt },
})
export default class WatchListView extends Vue {
  private readonly ROTATE_ITERATIONS = 30;
  private watchList: WatchListResponse[] = [];
  private nextMovie: NextMovieResponse | null = null;
  private nextMovieId!: number;
  private loading = false;
  private headers: Header[] = [
    {value: "movieTitle", style:"font-weight: 700", sortable: false, centerHeader: false},
    {value: "dateAdded", sortable: false},
    {value: "addedBy", sortable: false, includeHeader: false},
    {value: "reviewMovie", sortable: false, includeHeader: false}
  ];

  private modalOpen = false;
  private animateInterval!: number;
  private animate = false;

  private rotateReps = this.ROTATE_ITERATIONS;

  mounted(): void {
    this.loading = true;
    axios
      .get('/api/getWatchList')
      .then((response) => {
        this.loading = false;
        this.watchList = response.data.watchList;
        this.nextMovie = response.data.nextMovie;
      })
  }

  get watchListTableData(): any[] {
    if (!this.animate){
      const nextMovie: WatchListResponse | undefined = this.watchList.find(movie => movie.movieTitle === this.nextMovie?.movieTitle)
      let sortedWatchList = this.watchList

      // If there is a nextMovie set, it gets shifted to the top of the watch list
      if (nextMovie) {
        sortedWatchList = sortedWatchList.filter(movie => movie.movieTitle !== this.nextMovie?.movieTitle)
        sortedWatchList.unshift(nextMovie)
      }

      return sortedWatchList.map(movie => {
        return {
          movieTitle: movie.movieTitle,
          dateAdded: movie.dateAdded['@date'],
          addedBy: movie.addedBy,
          highlighted: movie.movieTitle === this.nextMovie?.movieTitle,
          reviewMovie: movie.movieId
        }
      })
    } else {
      const sortedWatchList = this.watchList;
      const fisrtMovieId = sortedWatchList[0].movieId;
      return sortedWatchList.map(movie => {
        return {
          movieTitle: movie.movieTitle,
          dateAdded: movie.dateAdded['@date'],
          addedBy: movie.addedBy,
          highlighted: movie.movieId === fisrtMovieId,
          reviewMovie: movie.movieId
        }
      })
    }
  }

  selectRandom(): void {
    let randomMovie = this.watchList[Math.floor(Math.random() * this.watchList.length)];
    this.nextMovieId = randomMovie.movieId;
    console.log(this.nextMovie);
    console.log(this.nextMovieId);

    this.rotateReps = this.ROTATE_ITERATIONS;
    this.animateInterval = setInterval(this.animateRotate, 100);
    this.animate = true;

    console.log("TODO: get watchlistId once we expand to other watchlists");
    axios.post(`/api/postNextWatch?movieId=${ randomMovie.movieId }&watchListId=${ 0 }&movieTitle=${ randomMovie.movieTitle }`)
          .then(
            (response) => {
              this.nextMovie = response.data;
              this.$emit("close", true, response.data);
            });
  }

  animateRotate(): void {
    if (this.rotateReps > 0 || this.watchList[0].movieId !== this.nextMovieId){
      this.watchList.unshift(this.watchList[this.watchList.length-1]);
      this.watchList.pop();
      this.rotateReps-=1;
    } else {
      clearInterval(this.animateInterval);
      this.animate = false;
    }
  }

  openPrompt(): void {
    this.modalOpen = true;
  }

  reviewMovie(movieId: number): void {
    axios.post(`/api/reviewMovieFromWatchList?movieId=${ movieId }`)
      .then(response => {
        // Remove movie from our table
        let idx = this.watchList.indexOf(response as unknown as WatchListResponse)
        this.watchList.splice(idx, 1)
        this.$router.push({path: "./reviews"})
      })
  }

  closePrompt(reviewAdded: boolean, newMovie: WatchListResponse): void {
    this.modalOpen = false;
    if (reviewAdded) {
      this.watchList.unshift(newMovie);
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
  margin-right: 1em;
}
</style>
