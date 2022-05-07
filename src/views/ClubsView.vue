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
    import { Component, Vue, Watch } from 'vue-property-decorator'
    import axios from 'axios'

    @Component({})

    export default class ClubsView extends Vue {
        private loading = true
        private user: any
        private clubs: string[] = []

        get isLoggedIn(): boolean {
            return this.$store.state.auth.user !== null
        }

        @Watch('isLoggedIn')
        onCountChange(newIsLoggedIn: any, oldIsLoggedIn: any) {
            if (newIsLoggedIn !== null) {
                axios
                .get(`/api/member/${this.$store.state.auth.user.email}`)
                .then((response) => {
                    this.user = response.data
                    this.user.clubs.forEach((clubId: number) => {
                        axios
                            .get(`/api/club/${clubId}/clubName`)
                            .then(response => {
                                this.clubs.push(response.data)
                                this.loading = false
                            })
                    })
                })
            }
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
