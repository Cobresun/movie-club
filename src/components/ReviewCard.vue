<template>
    <div class="border-2 border-gray-200 rounded w-40 mb-4">
        <loading-spinner v-if="loading" />
        <div class="flex flex-col h-full" v-else>
            <img :src="movie.poster_url" />
            <div class="px-2 pb-2 flex flex-col h-auto flex-grow">
                <div class="my-2 flex flex-grow items-center justify-center">
                    <h3 class="font-semibold h-min" style="height: min-content">{{ review.movieTitle }}</h3>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div 
                        v-for="member in members" :key="member.name"
                        class="flex items-center bg-lowBackground rounded-3xl"
                    >
                        <avatar
                            :size="32"
                            :fullname="member.name"
                            :image="member.image"
                        ></avatar>
                        <div class="flex-grow text-sm">
                            {{ review.scores[member.name] }}
                        </div>
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