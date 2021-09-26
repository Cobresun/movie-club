<template>
    <div>
        <div class="title">
            <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
            <h1>Cobresun Statistics</h1>
        </div>

        <loading-spinner v-if="loading"/>
        
        <div v-if="!loading">
            <h2>Most Loved Movie</h2>
            <img :src="mostLovedMovie.poster_url" />
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator'
    import axios from 'axios'
    import { TMDBMovieData } from '@/models';


    @Component({})

    export default class StatisticsView extends Vue {
        private loading = false
        private mostLovedMovie: TMDBMovieData|undefined

        mounted(): void {
            this.loading = true
            axios
                .get('/api/movie/446021')
                .then(response => {
                    this.loading = false
                    this.mostLovedMovie = response.data
                })
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