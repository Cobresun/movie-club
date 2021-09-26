<template>
    <div>
        <div class="title">
            <router-link to="/"><mdicon class="back" name="arrow-left" size="40"/></router-link>
            <h1>Cobresun Statistics</h1>
        </div>

        <div>
            <h2>Most Loved Movie</h2>
            <p>{{mostLovedMovie}}</p>
        </div>
    </div>
</template>

<script lang="ts">
    import { Vue } from 'vue-property-decorator'
    import axios from 'axios'

    export default class StatisticsView extends Vue {
        private mostLovedMovie!: any

        mounted(): void {
            axios
                .get('/api/movie/446021')
                .then(response =>
                    this.mostLovedMovie = response
                )
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