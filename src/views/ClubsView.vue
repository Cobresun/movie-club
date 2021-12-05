<template>
    <div>
        <div v-if="!isLoggedIn">Need to be logged in!</div>

        <div v-if="isLoggedIn">
            <loading-spinner v-if="loading"/>

            <div class="clubs" v-if="!loading">
                <div class="club-option" v-for="club in clubs" :key="club">
                    <router-link to="/clubHome">
                        <menu-card 
                            bgColor="var(--low-key-background-color)" 
                            image="club.svg"
                        >
                            {{ club }}
                        </menu-card>
                    </router-link>
                </div>
                <div class="club-option">
                    <router-link to="/clubHome">
                        <menu-card
                            bgColor="var(--low-key-background-color)" 
                            image="club.svg"
                        >
                            + New Club
                        </menu-card>
                    </router-link>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator'
    import axios from 'axios'

    @Component({})

    export default class ClubsView extends Vue {
        private loading = false
        private user: any
        private clubs: string[] = []

        mounted(): void {
            this.loading = true

            // TODO: Needs to only be done when loggedin, 
            // then replace hardcode with ${this.$store.state.auth.user.email}
            axios
                .get(`/api/member/cobresunofficial@gmail.com`)
                .then((response) => {
                    this.user = response.data
                    this.user.clubs.forEach((clubId: number) => {
                        axios
                            .get(`/api/club/${clubId}/clubName`)
                            .then(response => {
                                this.clubs.push(response.data)
                                this.loading = false
                            })
                    });
            })
        }

        get isLoggedIn(): boolean {
            return this.$store.state.auth.user !== null
        }
    }
</script>

<style scoped>
    .clubs {
        display: flex;
        justify-content: center;
        padding-bottom: 24px;
    }

    .club-option {
        padding: 12px;
    }

    @media (max-width: 700px) {
        .clubs {
            flex-direction: column;
        }
    }
</style>
