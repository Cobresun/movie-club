<!-- <template>
    <div>
        <div class="title">
            <router-link to="/clubHome"><mdicon class="back" name="arrow-left" size="40"/></router-link>
            <h1>Cobresun Statistics</h1>
            <div class="refresh" @click="refreshStats()"><mdicon name="refresh" size="40"/></div>
        </div>

        <loading-spinner v-if="loading"/>
        
        <div v-if="!loading">
            <!-- Make this a carousel if tied ->
            <div v-if="mostLovedMovie">
                <h2>Most Loved Movie</h2>
                <img :src="mostLovedMovie.poster_url" />
            </div>
            
            <!-- Make this a carousel if tied ->
            <div v-if="leastLovedMovie">
                <h2>Least Loved Movie</h2>
                <img :src="leastLovedMovie.poster_url" />
            </div>

            <h2>Each Member's Average Score</h2>

            <!-- Make this a carousel if tied ->
            <h2>Most Devisive Movie</h2>
            <!-- variance ->

            <!-- Make this a carousel if tied ->
            <h2>Most Seen Director</h2>
            <!-- And a list of the movies we've seen of theirs ->

            <!-- Make this a carousel if tied ->
            <h2>Most Loved Director</h2>

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

        private mostLovedMovie: TMDBMovieData|null = null
        private leastLovedMovie: TMDBMovieData|null = null

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

        refreshStats(): void {
            console.info("Refreshing stats...")
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
</style> -->
