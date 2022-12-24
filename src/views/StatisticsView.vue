<template>
  <div>
    <page-header :has-back="true" back-route="ClubHome" page-name="Statistics" />
    <loading-spinner v-if="loading" />

    <div v-if="!loading">
      <br/>
      <ag-charts-vue :options="histChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="scoreChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="budgetChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="revenueChartOptions"></ag-charts-vue>
      <br/>
      <ag-charts-vue :options="dateChartOptions"></ag-charts-vue>
      <br/>

      <select v-model="selectedChartBase" class="mb-2 mr-4 font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105">
        <option v-for="member in headers" :value="member.value">{{member.value}}</option>
      </select>
      <select v-model="selectedChartMeasure" class="mb-2 mr-4 font-bold text-base text-text tracking-wide bg-primary text-center cursor-pointer rounded-md duration-150 filter hover:brightness-110 active:brightness-105">
        <option v-for="key in Object.keys(movieData[0])" :value="key">{{key}}</option>
      </select>
      <br/>
      <ag-charts-vue :options="customChartOptions"></ag-charts-vue>
      <br/>

      <v-btn
        data-tooltip-target="tooltip-default"
        class="ui button big"
        @click="toggle"
        >{{normButtonText}}
      </v-btn>
      <!-- TODO make this tooltip work -->
      <div id="tooltip-default" role="tooltip" class="inline-block absolute invisible z-10 py-2 px-3 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm opacity-0 transition-opacity duration-300 tooltip dark:bg-gray-700">
          How many standard deviations is your score from average?
          <div class="tooltip-arrow" data-popper-arrow></div>
      </div>

      <movie-table
          :headers="headers"
          :data="movieData"
          v-if="reviews.length > 0"
      >
        <template v-for="member in members" v-slot:[normName(member.name)]>
            <v-avatar :src="member.image" :name="member.name" />
        </template>

        <template v-slot:[normName()]>
            <img src="@/assets/images/average.svg" class="w-16 h-12 max-w-none" />
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
import { useReview } from "@/data/useReview";
import { useMembers, useClub } from "@/data/useClub";
import { normalizeArray, loadDefaultChartSettings} from "../util/StatisticsUtils";

const route = useRoute();
const { loading: loadingClub, data: club } = useClub(route.params.clubId as string);
const { loading: loadingReviews, data: reviews } = useReview(
  route.params.clubId as string
);
const { loading: loadingMembers, data: members } = useMembers(
  route.params.clubId as string
);

const clubName = ref("Club");
const normButtonText = ref("Normalize Scores");
console.log(route);

const loadingCalculations = ref(true);

const normalize = ref(false);
const movieData = ref<any[]>([]);
const memberNames = ref<string[]>([]);
const selectedChartBase = ref("average");
const selectedChartMeasure = ref("runtime");
const histogramData = ref<any[]>([]);
const histogramNormData = ref<any[]>([]);

const scoreChartOptions = ref({});
const revenueChartOptions = ref({});
const budgetChartOptions = ref({});
const customChartOptions = ref({});
const dateChartOptions = ref({});
const histChartOptions = ref({});

const loading = computed(() => loadingReviews.value || loadingMembers.value ||
   loadingClub.value || loadingCalculations.value);

const fetchMovieData = async (reviews: ReviewResponse[]) => {
  return await Promise.all(reviews.map(review => {
    return axios
      .get('/api/movie/'+review.movieId)
      .then(response => {
          const obj: any = {
            movieTitle: review.movieTitle,
            dateWatched: DateTime.fromISO(review.timeWatched['@ts']).toLocaleString(),
            adult: response.data.adult,
            ...review.scores,
            ...response.data
          };
          return obj;
      })
  }));
}

const setReviews = (isLoading: boolean) => {
  if (isLoading) return;
  fetchMovieData(reviews.value).then(response => {
      movieData.value = response; 
      console.log(response);
      calculateStatistics();
    }
  );
  //movieData.value = movieMockData; //reduce api calls for development
  //calculateStatistics();
}

const setClub = (isLoading: boolean) => {
  if (isLoading) return;
  clubName.value = club.value.clubName;
}

watch(loadingReviews, setReviews);
setReviews(loadingReviews.value);

watch(loadingClub, setClub);
setClub(loadingClub.value);

const calculateStatistics = () => {
  memberNames.value = members.value
    .filter( member => !member.devAccount )
    .map( member => member.name );

  for(let i = 0; i <= 10; i++){
    histogramData.value[i] = {'bin': i};
    histogramNormData.value[i] = {'bin': i/4.0-1.25}; // TODO: stop using hardcoded bin for std
  }

  const memberScores: Record<string, number[]> = {};
  const tmbd_norm = normalizeArray(movieData.value.map(data => data['vote_average']));
  for (const member of memberNames.value){
    memberScores[member] = normalizeArray(movieData.value.map(data => data[member]));
    for(let i = 0; i <= 10; i++){
      histogramData.value[i][member] = 0;
      histogramNormData.value[i][member] = 0;
    }
  }

  for (let i = 0; i < movieData.value.length; i++) {
    let avg = 0;
    for (const member of memberNames.value){
      movieData.value[i][member+"Norm"] = memberScores[member][i];
      avg += memberScores[member][i];

      // Histogram
      const score = Math.floor(movieData.value[i][member]);
      if(isNaN(score)) continue;
      histogramData.value[score][member] += 1;
      let scoreNorm = Math.floor(movieData.value[i][member+"Norm"]*4+5);
      scoreNorm = scoreNorm < 0 ? 0 : scoreNorm > 10 ? 10 : scoreNorm;
      histogramNormData.value[scoreNorm][member] += 1;
    }
    avg = avg/memberNames.value.length;

    movieData.value[i]["averageNorm"] = Math.round(avg*100)/100;
    movieData.value[i]["release_year"] = parseInt(movieData.value[i]["release_date"].substring(0,4));
    movieData.value[i]["revenueMil"] = movieData.value[i]["revenue"]/1000000;  
    movieData.value[i]["budgetMil"] = movieData.value[i]["budget"]/1000000;
    movieData.value[i]["vote_averageNorm"] = tmbd_norm[i];
  }
  loadChartOptions();
  generateCustomChart();
  loadingCalculations.value = false;
}

const toggle = () => {
  normalize.value = !normalize.value;
  normButtonText.value = normalize.value ? "Denormalize Scores" : "Normalize Scores";
  loadChartOptions();
}

const generateCustomChart = () => {
  customChartOptions.value = loadDefaultChartSettings({
    chartTitle: 'Custom chart: ' + selectedChartBase.value + ' vs ' + selectedChartMeasure.value,
    xName: selectedChartMeasure.value,
    xData: selectedChartMeasure.value,
    yName: selectedChartBase.value,
    yData: selectedChartBase.value,
    movieData: movieData.value
  });
}

watch(selectedChartMeasure, generateCustomChart);
watch(selectedChartBase, generateCustomChart);

const loadChartOptions = () => {
  histChartOptions.value = {
    autoSize: true,
    theme: 'ag-default-dark',
    title: { text: "Score Histogram" },
    data: normalize.value ? histogramNormData.value : histogramData.value,
    series: memberNames.value.map((member) => {
      return {
        type: 'line',
        xKey: 'bin',
        xName: 'Score',
        yKey: member,
        yName: member,
        showInLegend: true,
        tooltip: {
            renderer: function (params) {
                return '<div class="ag-chart-tooltip-title" ' + 'style="background-color:' + params.color + '">' + params.yKey + '</div>' + 
                  '<div class="ag-chart-tooltip-content">' + params.xName + ': ' + params.xValue + '</br>' + params.yName + ': ' + params.yValue + '</div>';
            }
        }
      }
    }),
    axes: [
      {
        type: 'number',
        position: 'bottom',
        title: {
          enabled: true,
          text: 'Score',
        }
      },
      {
        type: 'number',
        position: 'left',
        title: {
          enabled: true,
          text: 'Frequency of Score',
        }
      },
    ],
  };

  scoreChartOptions.value = loadDefaultChartSettings({
    chartTitle: clubName.value+' Score vs Audience Score',
    xName: 'TMDB Audience Score',
    xData: 'vote_average',
    normalizeX: true,
    yName: clubName.value+' Score',
    yData: 'average',
    normalizeY: true,
    normalizeToggled: normalize.value,
    movieData: movieData.value
  });

  budgetChartOptions.value = loadDefaultChartSettings({
    chartTitle: clubName.value+' Score vs Film Budget (Millions)',
    xName: 'Film Budget ($mil)',
    xData: 'budgetMil',
    normalizeX: false,
    yName: clubName.value+' Score',
    yData: 'average',
    normalizeY: true,
    normalizeToggled: normalize.value,
    movieData: movieData.value
  });

  revenueChartOptions.value = loadDefaultChartSettings({
    chartTitle: clubName.value+' Score vs Film Revenue (Millions)',
    xName: 'Film Revenue ($mil)',
    xData: 'revenueMil',
    normalizeX: false,
    yName: clubName.value+' Score',
    yData: 'average',
    normalizeY: true,
    normalizeToggled: normalize.value,
    movieData: movieData.value
  });

  dateChartOptions.value = loadDefaultChartSettings({
    chartTitle: clubName.value+' Score vs Release Date',
    xName: 'Date',
    xData: 'release_year',
    normalizeX: false,
    yName: clubName.value+' Score',
    yData: 'average',
    normalizeY: true,
    normalizeToggled: normalize.value,
    movieData: movieData.value
  });
}

const normName = (name: string = 'average') => {
  return normalize.value ? name+"Norm" : name;
}

const headers = computed(() => {
  const headers: Header[] = [
    {value: "movieTitle", style:"font-weight: 700", title:"Title"},
    {value: "dateWatched", title:"Date Reviewed"}];

  if (members.value.length > 0) {
    for (const member of members.value) {
      if (!member.devAccount) {
        headers.push({value: member.name + (normalize.value ? "Norm" : "")});
      }
    }
  }
  headers.push({value: "average" + (normalize.value ? "Norm" : "")});
  headers.push({value: "vote_average" + (normalize.value ? "Norm" : ""), title:"TMDB"});
  return headers;
});
</script>
