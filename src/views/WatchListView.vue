<template>
  <div class="m-2">
    <add-movie-to-watchlist-prompt
      v-if="modalOpen"
      @close="closePrompt" 
    />
    <div>
      <div class="grid items-center grid-cols-centerHeader gap-x-8">
        <router-link
          class="flex justify-end"
          to="/clubHome"
        >
          <mdicon
            class="cursor-pointer"
            name="arrow-left"
            size="40"
          />
        </router-link>
        <h1 class="text-3xl font-bold m-4">
          Cobresun Watch List
        </h1>
      </div>

      <loading-spinner v-if="loading" />

      <div v-if="!loading">
        <v-btn
          class="float-left mr-3"
          @click="openPrompt"
        >
          Add Movie
          <mdicon name="plus" />
        </v-btn>

        <v-btn
          class="float-left mr-3"
          @click="selectRandom()"
        >
          Random
          <mdicon name="dice-multiple-outline" />
        </v-btn>

        <movie-table
          :header="false" 
          :headers="headers"
          :data="watchListTableData"
        >
          <template #movieTitle />
          
          <template #dateAdded />
          
          <template #item-addedBy="slotProps">
            <v-avatar
              :key="slotProps.item[slotProps.head.value]"
              :src="members.find(member => member.name === slotProps.item[slotProps.head.value]).image"
            />
          </template>

          <template #item-reviewMovie="slotProps">
            <v-btn @click="reviewMovie(slotProps.item[slotProps.head.value])">
              <mdicon name="check" />
            </v-btn>
          </template>

          <template #item-makeNextWatch="slotProps">
            <v-btn @click="makeNextWatch(slotProps.item[slotProps.head.value])">
              <mdicon name="arrow-collapse-up" />
            </v-btn>
          </template>
        </movie-table>
      </div>
    </div>
  </div>
</template>

<script lang="ts">

@Component({
  components: { AddMovieToWatchlistPrompt },
})
export default class WatchListView extends Vue {
  private readonly ROTATE_ITERATIONS = 30;
  private watchList: WatchListResponse[] = [];
  private nextMovie: NextMovieResponse | null = null;
  private nextMovieId!: number;
  private members: Member[] = [];
  private loading = false;
  private loadingMembers = false;
  private headers: Header[] = [
    {value: "movieTitle", style:"font-bold", sortable: false, centerHeader: false},
    {value: "dateAdded", sortable: false},
    {value: "addedBy", sortable: false, includeHeader: false},
    {value: "reviewMovie", sortable: false, includeHeader: false},
    {value: "makeNextWatch", sortable: false, includeHeader: false}
  ];

  private animateInterval!: number;
  private animate = false;

  private rotateReps = this.ROTATE_ITERATIONS;

  get watchListTableData(): any[] {
    if (!this.animate){
      
      let sortedWatchList = this.watchList

      // If there is a nextMovie set, it gets shifted to the top of the watch list
      if (nextMovie) {
        sortedWatchList = sortedWatchList.filter(movie => movie.movieTitle !== this.nextMovie?.movieTitle)
        sortedWatchList.unshift(nextMovie)
      }

      return sortedWatchList.map(movie => {
        return {
          movieTitle: movie.movieTitle,
          dateAdded: DateTime.fromISO(movie.timeAdded['@ts']).toLocaleString(),
          addedBy: movie.addedBy,
          highlighted: movie.movieTitle === this.nextMovie?.movieTitle,
          reviewMovie: movie.movieId,
          makeNextWatch: movie.movieId
        }
      })
    } else {
      const sortedWatchList = this.watchList;
      const fisrtMovieId = sortedWatchList[0].movieId;
      return sortedWatchList.map(movie => {
        return {
          movieTitle: movie.movieTitle,
          dateAdded: DateTime.fromISO(movie.timeAdded['@ts']).toLocaleString(),
          addedBy: movie.addedBy,
          highlighted: movie.movieId === fisrtMovieId,
          reviewMovie: movie.movieId,
          makeNextWatch: movie.movieId
        }
      })
    }
  }

  selectRandom(): void {
    let randomMovie = this.watchList[Math.floor(Math.random() * this.watchList.length)];
    this.nextMovieId = randomMovie.movieId;

    this.rotateReps = this.ROTATE_ITERATIONS;
    this.animateInterval = setInterval(this.animateRotate, 100);
    this.animate = true;

    axios.post(`/api/postNextWatch?movieId=${ randomMovie.movieId }&watchListId=${ 0 }&movieTitle=${ randomMovie.movieTitle }`, {}, {
      headers: {
        Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
      }
    }).then((response) => {
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

  reviewMovie(movieId: number): void {
    axios.post<WatchListResponse>(`/api/reviewMovieFromWatchList?movieId=${ movieId }`, {}, {
      headers: {
        Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
      }
    }).then(response => {
        // Remove movie from our table
        let idx = this.watchList.indexOf(response.data)
        this.watchList.splice(idx, 1)
        this.$router.push({path: "./reviews"})
      })
  }

  makeNextWatch(movieId: number): void {
    this.nextMovieId = movieId;
    const movieTitle = this.watchList.find(movie => movie.movieId === movieId)?.movieTitle

    axios.post(`/api/postNextWatch?movieId=${ movieId }&watchListId=${ 0 }&movieTitle=${ movieTitle }`, {}, {
      headers: {
        Authorization: `Bearer ${this.$store.state.auth.user.token.access_token}`
      }
    })
      .then(
        (response) => {
          this.nextMovie = response.data;
          this.$emit("close", true, response.data);
        });
  }
}
</script>
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { DateTime } from 'luxon';
import { WatchListResponse, Header, NextMovieResponse, Member, WatchListItem, ReviewResponse } from '@/models';
import AddMovieToWatchlistPrompt from '@/components/SearchPrompt/AddMovieToWatchlistPrompt.vue';

const store = useStore();
const router = useRouter();

const watchList = ref<WatchListItem[]>([]);
const nextMovie = ref<NextMovieResponse>();
const members = ref<Member[]>([]);

const loadingWatchList = ref(true);
const loadingMembers = ref(true);
const loading = computed(() => loadingWatchList.value || loadingMembers.value );

axios
  .get<WatchListResponse>('/api/getWatchList')
  .then((response) => {
    loadingWatchList.value = false;
    watchList.value = response.data.watchList;
    nextMovie.value = response.data.nextMovie;
  });
axios
  .get('/api/club/8/members')
  .then((response) => {
    loadingMembers.value = false;
    members.value = response.data;
  });

const headers: Header[] = [
  {value: "movieTitle", style:"font-bold", sortable: false, centerHeader: false},
  {value: "dateAdded", sortable: false},
  {value: "addedBy", sortable: false, includeHeader: false},
  {value: "reviewMovie", sortable: false, includeHeader: false},
  {value: "makeNextWatch", sortable: false, includeHeader: false}
];

const watchListTableData = computed(() => {
  let sortedWatchList = watchList.value.slice(0);
  if (!animate.value) {
    const nextMovieItem: WatchListItem | undefined = watchList.value.find(movie => movie.movieTitle === nextMovie.value?.movieTitle);

    if (nextMovieItem) {
      sortedWatchList = watchList.value.filter(movie => movie.movieId !== nextMovieItem.movieId);
      sortedWatchList.unshift(nextMovieItem);
    }
  }

  return sortedWatchList.map(movie => {
    return {
      movieTitle: movie.movieTitle,
      dateAdded: DateTime.fromISO(movie.timeAdded['@ts']).toLocaleString(),
      addedBy: movie.addedBy,
      highlighted: movie.movieTitle === nextMovie.value?.movieTitle
    }
  });
});

const reviewMovie = (movieId: number) => {
  axios.post<WatchListItem>(`/api/reviewMovieFromWatchList?movieId=${ movieId }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then(response => {
    const idx = watchList.value.indexOf(response.data);
    watchList.value.splice(idx,1);
    router.push({name:"Reviews"});
  })
};

const makeNextWatch = (movieId: number) => {
  nextMovieId.value = movieId;
}

const ROTATE_ITERATIONS = 30;
const rotateReps = ref(ROTATE_ITERATIONS);
const animate = ref(false);
const nextMovieId = ref<number | undefined>();
const animateInterval = ref<number | undefined>();

const selectRandom = () => {
  let randomMovie = watchList.value[Math.floor(Math.random() * watchList.value.length)];
  nextMovieId.value = randomMovie.movieId;
  rotateReps.value = ROTATE_ITERATIONS;
  animateInterval.value = window.setInterval(animateRotate, 100);
  animate.value = true;

  axios.post<NextMovieResponse>(`/api/postNextWatch?movieId=${ randomMovie.movieId }&watchListId=${ 0 }&movieTitle=${ randomMovie.movieTitle }`, {}, {
    headers: {
      Authorization: `Bearer ${store.state.auth.user.token.access_token}`
    }
  }).then((response) => {
    nextMovie.value = response.data;
  });
}

const animateRotate = () => {
  if (rotateReps.value > 0 || watchList.value[0].movieId !== nextMovieId.value) {
    watchList.value.unshift(watchList.value[watchList.value.length-1]);
    watchList.value.pop();
    rotateReps.value-=1;
  } else {
    window.clearInterval(animateInterval.value);
  }
}

const modalOpen = ref(false);
const openPrompt = () => { modalOpen.value = true };
const closePrompt = (movie: WatchListItem) => {
  modalOpen.value = false;
  if (movie) {
    watchList.value.unshift(movie);
  }
};
</script>