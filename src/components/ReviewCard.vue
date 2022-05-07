<template>
<div class="card">
    <loading-spinner v-if="loading" />
    
    <div v-else>
        <img :src="movie.poster_url" style="width:100%"/>
        <h3>{{ review.movieTitle }}</h3>
        <div class="chips">
            <div v-for="member in members" :key="member.name">
                <div class="chip">
                    <img :src="member.image" width="96" height="96">
                    {{ review.scores[member.name] }}
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import { ReviewResponse, TMDBMovieData, Member } from '@/models'
import axios from 'axios'

@Component({
  components: { },
})

export default class ReviewView extends Vue {
    @Prop() review! : ReviewResponse
    @Prop() members! : Member[]
    
    private loading = true
    private movie!: TMDBMovieData

    mounted(): void {
        axios
            .get<TMDBMovieData>(`/api/movie/${this.review.movieId}`)
            .then((response) => {
                this.loading = false
                this.movie = response.data
            })
    }
}
</script>

<style scoped>
    .card {
        border: 2px solid #e7e7e7;
        border-radius: 4px;
        transition: 0.5s ease;
        padding-bottom: 1rem;
    }

    .card:hover {
        -webkit-transform:scale(1.1);
        -ms-transform: scale(1.1);
        transform: scale(1.1);
        transition: 0.5s ease;
    }

    img {
        object-fit: cover;
    }

    .chips {
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, 130px);
        grid-auto-rows: auto;
        grid-gap: 1rem;
        justify-content: center;
    }

    .chip {
        display: inline-block;
        padding: 0 25px;
        height: 50px;
        font-size: 16px;
        line-height: 50px;
        border-radius: 25px;
        background-color: var(--low-key-background-color);
    }

    .chip img {
        float: left;
        margin: 0 10px 0 -25px;
        height: 50px;
        width: 50px;
        border-radius: 50%;
    }
</style>
