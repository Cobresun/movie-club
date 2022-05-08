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

    img {
        object-fit: cover;
    }

    .chips {
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: auto;
        row-gap: 1rem;
        column-gap: 0.5rem;
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

    @media screen and (max-width: 600px) {
        h3 {
            font-size: small;
        }

        .chips {
            gap: 0.5rem;
        }

        .chip {
            height: 25px;
            line-height: 25px;
            padding: 0 12px;
            font-size: 13px;
        }

        .chip img {
            margin: 0 10px 0 -12px;
            height: 25px;
            width: 25px;
        }
    }
</style>
