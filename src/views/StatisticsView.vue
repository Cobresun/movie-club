<template>
  <div>
    <!-- <div class="title">
      <router-link to="/clubHome"
        ><mdicon class="back" name="arrow-left" size="40"
      /></router-link>
      <h1>Cobresun Statistics</h1>
      <div class="refresh" @click="refreshStats()">
        <mdicon name="refresh" size="40" />
      </div>
    </div> -->

    <page-header :has-back="true" back-route="ClubHome" page-name="Statistics" />
    <loading-spinner v-if="loading" />

    <div v-if="!loading">
      <!-- Make this a carousel if tied -->
      <!-- <div v-if="mostLovedMovie">
        <h2>Most Loved Movie</h2>
        <img :src="mostLovedMovie.poster_url" />
      </div> -->

      <!-- Make this a carousel if tied -->
      <!-- <div v-if="leastLovedMovie">
        <h2>Least Loved Movie</h2>
        <img :src="leastLovedMovie.poster_url" />
      </div> -->

      <!-- <h2>Most Devisive Movie</h2>
      <h2>Most Seen Director</h2>
      <h2>Most Loved Director</h2> -->

      <br/>
      <ag-charts-vue :options="scoreChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="budgetChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="revenueChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="dateChartOptions"></ag-charts-vue>
      <br/>
      <!-- <ag-charts-vue :options="distributionChartOptions"></ag-charts-vue> -->
      <!-- <ag-charts-vue :options="normDistributionChartOptions"></ag-charts-vue> -->

      <v-btn
        class="ui button big"
        v-bind:class="{'green': normalize, 'gray': !normalize}"
        @click="toggle"
        >Normalise Scores
      </v-btn>

      <movie-table
          :headers="normalize?normHeaders:headers"
          :data="movieData"
          v-if="reviews.length > 0"
      >
        <template v-for="member in members" v-slot:[normName(member.name)]>
            <v-avatar :src="member.image" :name="member.name" />
        </template>

        <template #average>
            <img src="@/assets/average.svg" class="w-16 h-12 max-w-none" />
        </template>
        <template #averageNorm>
            <img src="@/assets/average.svg" class="w-16 h-12 max-w-none" />
        </template>
      </movie-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { AgChartsVue } from 'ag-charts-vue3';
import { useRoute } from "vue-router";
import axios from "axios";
import { DateTime } from "luxon";
import { ReviewResponse, TMDBMovieData, Member, Header } from "@/models";
import { useReview, useSubmitScore } from "@/data/useReview";
import { useMembers } from "@/data/useClub";
import movieMockData from './richMovieDataCopy.json';

const route = useRoute();
console.log(route);

const loadingCalculations = ref(true);
const loadingMostLovedMovie = ref(false);
const loadingLeastMostLovedMovie = ref(false);
//const loadingReviews = ref(true);

const normalize = ref(false);
const movieData = ref<any[]>([]);

const scoreChartOptions = ref({});
const revenueChartOptions = ref({});
const budgetChartOptions = ref({});
const dateChartOptions = ref({});
const distributionChartOptions = ref({});
const normDistributionChartOptions = ref({});

const mostLovedMovie = ref<TMDBMovieData | null>(null);
const leastLovedMovie = ref<TMDBMovieData | null>(null);
console.log(route);
const { loading: loadingReviews, data: reviews } = useReview(
  route.params.clubId as string
);

const setReviews = (isLoading: boolean) => {
  if (isLoading) return;
  // fetchMovieData(reviews).then(response => {
  //     movieData.value = response; 
  //     calculateStatistics();
  //   }
  // );
  movieData.value = movieMockData; //reduce api calls for development
  calculateStatistics();
}

watch(loadingReviews, setReviews);
setReviews(loadingReviews.value);

const { loading: loadingMembers, data: members } = useMembers(
  route.params.clubId as string
);

// axios
//     .get('/api/movie/496243')
//     .then(response => {
//         mostLovedMovie.value = response.data
//         loadingMostLovedMovie.value = false
//     })

// axios
//     .get('/api/movie/1724')
//     .then(response => {
//         leastLovedMovie.value = response.data
//         loadingLeastMostLovedMovie.value = false
//     })

const fetchMovieData = async (reviews: ReviewResponse[]) => {
  const data: any[] = [];
  const promise: any[] = [];
  for (let i = 0; i < reviews.length; i++) {
    promise.push(
      axios
      .get('/api/movie/'+reviews[i].movieId)
      .then(response => {
          const obj: any = {...response.data};
          obj.movieTitle = reviews[i].movieTitle;
          obj.dateWatched = DateTime.fromISO(reviews[i].timeWatched['@ts']).toLocaleString();  
          obj.movieId = reviews[i].movieId;
          obj.adult = response.data.adult;
          for (const key of Object.keys(reviews[i].scores)) {
            obj[key] = (reviews[i].scores as any)[key];
            // Round the score to 2 decimal places
            //obj[key] = Math.round(obj[key] * 100)/100
          }
          data[i] = obj;
      })
    );
  }
  await Promise.all(promise);
  return data;
}

const calculateStatistics = () => {
  const coleScores: number[] = normalizeArray(movieData.value.map(data => data.cole));
  const brianScores: number[] = normalizeArray(movieData.value.map(data => data.brian));
  const wesleyScores: number[] = normalizeArray(movieData.value.map(data => data.wes));
  const sunnyScores: number[] = normalizeArray(movieData.value.map(data => data.sunny));
  let sunnysnines = 0;
  for (let i = 0; i < movieData.value.length; i++) {
    const scores = reviews.value[i].scores;
    movieData.value[i]["coleNorm"] = coleScores[i];
    movieData.value[i]["wesNorm"] = wesleyScores[i];
    movieData.value[i]["brianNorm"] = brianScores[i];
    movieData.value[i]["sunnyNorm"] = sunnyScores[i];
    let avg = (coleScores[i] + wesleyScores[i] + brianScores[i] + sunnyScores[i])/4;
    movieData.value[i]["averageNorm"] = Math.round(avg*100)/100;

    movieData.value[i]["release_year"] = parseInt(movieData.value[i]["release_date"].substring(0,4));

    if(movieData.value[i]["brian"] >= 9){
      //console.log(movieData.value[i]["brian"]+ ": " + movieData.value[i]["title"]);
      sunnysnines += 1;
    }

    movieData.value[i]["revenueMil"] = movieData.value[i]["revenue"]/1000000;  
    movieData.value[i]["budgetMil"] = movieData.value[i]["budget"]/1000000;  

  }
  console.log(sunnysnines);
  console.log(movieData.value);
  loadChartOptions();

  for (let i = 0; i < movieData.value.length; i++) {

  }
  loadingCalculations.value = false;
}

const normalizeArray = (array: number[]) => {
  var sum: number = 0;
  var count: number = 0;
  for (let i = 0; i < array.length; i++) {
    if (array[i] === undefined)
      count++;
    else
      sum += array[i];
  }
  const mean: number = sum / (array.length-count);
  const cleanArray: number[] = array.map((score) => {
    return score === undefined ? mean : score;
  });
  const variance = cleanArray.reduce((s, n) => s + (n - mean) ** 2, 0) / (cleanArray.length - 1);
  const std = Math.sqrt(variance);
  const normArray: number[] = cleanArray.map(x => ((x-mean)/std));
  const max: number = Math.max.apply(Math, normArray);
  const min: number = Math.min.apply(Math, normArray);
  // Scale normalized data to 0-10
  const scaledArray: number[] = normArray.map(x =>  scaleScore(x, min, max));
  return scaledArray;
}

const scaleScore = (value: number, min: number, max: number) => {
  let score: number = ((value-min)/(max-min))*9+1;
  return Math.round(score*100)/100;
}

const refreshStats = () => {
  console.info("Refreshing stats...");
}

const toggle = () => {
  normalize.value = !normalize.value;
}

const loadChartOptions = () => {
  scoreChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: {
      text: 'Cobresun Score vs Audience Score',
    },
    data: movieData.value,
    series: [{
        type: 'scatter',
        xKey: 'averageNorm',
        xName: 'Cobresun Score',
        yKey: 'vote_average',
        yName: 'TMDB Audience Score',
        showInLegend: false,
        tooltip: {
            renderer: function (params) {
                return '<div class="ag-chart-tooltip-title" ' + 'style="background-color:' + params.color + '">' + params.datum.movieTitle + '</div>' + 
                  '<div class="ag-chart-tooltip-content">' + params.xName + ': ' + params.xValue + '</br>' + params.yName + ': ' + params.yValue + '</div>';
            }
        }
    }],
    axes: [
      {
        type: 'number',
        position: 'bottom',
        min: 0,
        max: 10
      },
      {
        type: 'number',
        position: 'left',
        min: 5,
        max: 10
      },
    ],
  };

  budgetChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: {
      text: 'Cobresun Score vs Film Budget (Millions)',
    },
    data: movieData.value,
    series: [{
      type: 'scatter',
      xKey: 'averageNorm',
      xName: 'Cobresun Score',
      yKey: 'budgetMil',
      yName: 'Film Budget',
      showInLegend: false,
      tooltip: {
          renderer: function (params) {
              return '<div class="ag-chart-tooltip-title" ' + 'style="background-color:' + params.color + '">' + params.datum.movieTitle + '</div>' + 
                '<div class="ag-chart-tooltip-content">' + params.xName + ': ' + params.xValue + '</br>' + params.yName + ': ' + params.yValue + '</div>';
          }
      }
    }],
    axes: [
      {
        type: 'number',
        position: 'bottom',
        min: 0,
        max: 10
      },
      {
        type: 'number',
        position: 'left',
      },
    ],
  };

  revenueChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: {
      text: 'Cobresun Score vs Film Revenue (Millions)',
    },
    data: movieData.value,
    series: [{
      type: 'scatter',
      xKey: 'averageNorm',
      xName: 'Cobresun Score',
      yKey: 'revenueMil',
      yName: 'Film Revenue',
      showInLegend: false,
      tooltip: {
          renderer: function (params) {
              return '<div class="ag-chart-tooltip-title" ' + 'style="background-color:' + params.color + '">' + params.datum.movieTitle + '</div>' + 
                '<div class="ag-chart-tooltip-content">' + params.xName + ': ' + params.xValue + '</br>' + params.yName + ': ' + params.yValue + '</div>';
          }
      }
    }],
    axes: [
      {
        type: 'number',
        position: 'bottom',
        min: 0,
        max: 10
      },
      {
        type: 'number',
        position: 'left',
      },
    ],
  };

  dateChartOptions.value = {
    autoSize: true,
    theme: 'ag-material-dark',
    title: {
      text: 'Cobresun Score vs Release Date',
    },
    data: movieData.value,
    series: [{
      type: 'scatter',
      yKey: 'averageNorm',
      yName: 'Cobresun Score',
      xKey: 'release_year',
      xName: 'Date',
      showInLegend: false,
      tooltip: {
          renderer: function (params) {
              return '<div class="ag-chart-tooltip-title" ' + 'style="background-color:' + params.color + '">' + params.datum.movieTitle + '</div>' + 
                '<div class="ag-chart-tooltip-content">' + params.xName + ': ' + params.xValue + '</br>' + params.yName + ': ' + params.yValue + '</div>';
          }
      }
    }],
    axes: [
      {
        type: 'number',
        position: 'left',
      },
      {
        type: 'number',
        position: 'bottom'
      }
    ],
  };

  let bins = [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,8],[8,9],[9,10]];
  distributionChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: {
      text: 'Cobresun Score Distributions',
    },
    data: movieData.value,
    series: [{
      type: 'histogram',
      xKey: 'average',
      xName: 'Cobresun Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'red',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'cole',
      xName: 'Cole Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'blue',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'brian',
      xName: 'Brian Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'yellow',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'wes',
      xName: 'Wesley Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'green',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'sunny',
      xName: 'Sunny Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'purple',
      bins: bins,
      showInLegend: false
    }]
  };
  normDistributionChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: {
      text: 'Cobresun Normalized Score Distributions',
    },
    data: movieData.value,
    series: [{
      type: 'histogram',
      xKey: 'averageNorm',
      xName: 'Cobresun Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'red',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'coleNorm',
      xName: 'Cole Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'blue',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'brianNorm',
      xName: 'Brian Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'yellow',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'wesNorm',
      xName: 'Wesley Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'green',
      bins: bins,
      showInLegend: false
    },
    {
      type: 'histogram',
      xKey: 'sunnyNorm',
      xName: 'Sunny Score',
      fillOpacity: 0,
      strokeWidth: 3,
      stroke: 'purple',
      bins: bins,
      showInLegend: false
    }]
  };
  ///////////////////
}

const loading = computed(() => {
  return loadingMostLovedMovie.value ||
    loadingLeastMostLovedMovie.value ||
    loadingCalculations.value;
});

const normName = (name: string) => {
  return normalize.value ? name+"Norm" : name;
}

const headers = computed(() => {
  const headers: Header[] = [
    {value: "movieTitle", style:"font-weight: 700", title:"Title"},
    {value: "dateWatched", title:"Date Reviewed"}];

  if (members.value.length > 0) {
    for (const member of members.value) {
      if (!member.devAccount) {
        headers.push({value: member.name});
      }
    }
  }
  headers.push({value: "average"});
  headers.push({value: "vote_average", title:"TMDB"});
  return headers;
});

const normHeaders = computed(() => {
  const headers: Header[] = [
    {value: "movieTitle", style:"font-weight: 700", title:"Title"},
    {value: "dateWatched", title:"Date Reviewed"}];

  if (members.value.length > 0) {
    for (const member of members.value) {
      if (!member.devAccount) {
        headers.push({value: member.name+"Norm"});
      }
    }
  }
  headers.push({value: "averageNorm"});
  headers.push({value: "vote_average", title:"TMDB"});
  return headers;
});
</script>

<style scoped>
.title {
  display: grid;
  grid-column-gap: 32px;
  align-items: center;
  grid-template-columns: 1fr auto 1fr;
}

.title:first-child {
  justify-items: end;
}

.back {
  color: var(--text-color);
}

.back:hover {
  cursor: pointer;
}

.refresh {
  justify-self: start;
}

.refresh:hover {
  cursor: pointer;
}

.green {
  background-color: green;
}
</style>
