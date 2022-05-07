<template>
<div>
    <div class="title">
        <router-link to="/clubHome"><mdicon class="back" name="arrow-left" size="40"/></router-link>
        <h1>Cobresun Reviews</h1>
    </div>

    <loading-spinner v-if="loading"/>

    <div v-else class="cards">
        <div v-for="review in reviews" :key="review.movieId">
            <ReviewCard :review="review" :members="members"/>
        </div>
    </div>
</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { ReviewResponse, Member } from '@/models'
import axios from 'axios'

import ReviewCard from '@/components/ReviewCard.vue';


@Component({
  components: { ReviewCard },
})

export default class ReviewsGalleryView extends Vue {
    private reviews: ReviewResponse[] = []
    private members: Member[] = []

    private loadingReviews = false
    private loadingMembers = false

    get loading(): boolean {
        return this.loadingReviews || this.loadingMembers
    }

    mounted(): void {
        this.loadingReviews = true
        axios
            .get<ReviewResponse[]>('/api/getReviews')
            .then((response) => {
                this.loadingReviews = false
                this.reviews = response.data
            })
        this.loadingMembers = true;
        axios
            .get<Member[]>('/api/club/8/members')
            .then((response) => {
                this.loadingMembers = false
                this.members = response.data.filter(member => !member.devAccount)
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

    .back {
        color: var(--text-color);
    }

    .back:hover {
        cursor: pointer;
    }

    .cards {
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, 320px);
        grid-auto-rows: auto;
        grid-gap: 2rem;
        justify-content: center;
    }
</style>
