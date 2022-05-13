<template>
    <div class="m-1">
        <div class="grid items-center grid-cols-centerHeader gap-x-8">
            <router-link class="flex justify-end" to="/clubHome"><mdicon class="cursor-pointer" name="arrow-left" size="40"/></router-link>
            <h1 class="text-3xl font-bold m-4">Cobresun Reviews</h1>
        </div>

        <loading-spinner v-if="loading"/>

        <div v-else>
            <input
                class=" mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
                placeholder="Search"
                @input="updateSearch($event.target.value)"
            />
            <div class="grid grid-cols-auto justify-items-center">
                <ReviewCard
                    v-for="review in filteredReviews"
                    :review="review" 
                    :members="members"
                    :key="review.movieId"
                />
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { ReviewResponse, Member } from '@/models'
import axios from 'axios'

import ReviewCard from '@/components/ReviewCard.vue'


@Component({
  components: { ReviewCard },
})

export default class ReviewsGalleryView extends Vue {
    allReviews: ReviewResponse[] = []
    members: Member[] = []
    search = ""

    loadingReviews = false
    loadingMembers = false

    get loading(): boolean {
        return this.loadingReviews || this.loadingMembers
    }

    get filteredReviews(): ReviewResponse[] {
        return this.allReviews.filter(review => 
            review.movieTitle.toLowerCase().includes(this.search.toLowerCase())
            // TODO: Get the TMDB response in this component and filter by various other things like studio, director, etc.
        )
    }

    mounted(): void {
        this.loadingReviews = true
        axios
            .get<ReviewResponse[]>('/api/getReviews')
            .then((response) => {
                this.loadingReviews = false
                this.allReviews = response.data
            })
        this.loadingMembers = true;
        axios
            .get<Member[]>('/api/club/8/members')
            .then((response) => {
                this.loadingMembers = false
                this.members = response.data.filter(member => !member.devAccount)
            })
    }

    updateSearch(newSearch: string): void {
        this.search = newSearch
    }
}

</script>
