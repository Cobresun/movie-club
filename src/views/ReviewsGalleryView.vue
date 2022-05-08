<template>
<div>
    <div class="title">
        <router-link to="/clubHome"><mdicon class="back" name="arrow-left" size="40"/></router-link>
        <h1>Cobresun Reviews</h1>
    </div>

    <loading-spinner v-if="loading"/>

    <div v-else>
        <ReviewsSearchBar class="searchBar" v-model="search" @updateSearch="updateSearch" />

        <div class="cards">
            <div v-for="review in filteredReviews" :key="review.movieId">
                <ReviewCard :review="review" :members="members"/>
            </div>
        </div>
    </div>
</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { ReviewResponse, Member } from '@/models'
import axios from 'axios'

import ReviewsSearchBar from '@/components/ReviewsSearchBar.vue'
import ReviewCard from '@/components/ReviewCard.vue'


@Component({
  components: { ReviewCard, ReviewsSearchBar },
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

<style scoped>
.title {
    display: grid;
    grid-column-gap: 32px;
    align-items: center;
    grid-template-columns: 1fr auto 1fr;
}

.back {
    color: var(--text-color);
}

.back:hover {
    cursor: pointer;
}

.searchBar {
    margin-bottom: 1rem;
}

.cards {
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
    grid-auto-rows: auto;
    grid-gap: 2rem;
    justify-content: center;
}

@media screen and (max-width: 600px) {
    .cards {
        grid-template-columns: 1fr 1fr;
    }
}
</style>
