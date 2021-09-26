<template>
    <div>
        <div class="title">
            <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
            <h1>Cobresun Statistics</h1>
        </div>

        <loading-spinner v-if="loading"/>
        
        <div v-if="!loading">
            <h2 v-if="mostLovedMovie">Most Loved Movie</h2>
            <img :src="mostLovedMovie.poster_url" />

            <h2 v-if="leastLovedMovie">Least Loved Movie</h2>
            <img :src="leastLovedMovie.poster_url" />
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator'
    import axios from 'axios'
    import { TMDBMovieData } from '@/models';


    @Component({})

    export default class StatisticsView extends Vue {
        private loadingMostLovedMovie = false
        private loadingLeastMostLovedMovie = false

        private mostLovedMovie: TMDBMovieData|undefined
        private leastLovedMovie: TMDBMovieData|undefined

        mounted(): void {
            this.loadingMostLovedMovie = true
            this.loadingLeastMostLovedMovie = true

            axios
                .get('/api/movie/496243')
                .then(response => {
                    this.mostLovedMovie = response.data
                    this.loadingMostLovedMovie = false
                })

            axios
                .get('/api/movie/1724')
                .then(response => {
                    this.leastLovedMovie = response.data
                    this.loadingLeastMostLovedMovie = false
                })
        }

        get loading(): boolean {
            return this.loadingMostLovedMovie || this.loadingLeastMostLovedMovie
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
</style>