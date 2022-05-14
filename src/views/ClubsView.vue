<!-- <template>
    <div>
        <div v-if="!isLoggedIn">Need to be logged in!</div>

        <div v-if="isLoggedIn">
            <loading-spinner v-if="loading"/>

            <div class="flex justify-center pb-6 flex-col md:flex-row" v-if="!loading">
                <div class="p-3" v-for="club in clubs" :key="club">
                    <router-link to="/clubHome">
                        <menu-card 
                            bgColor="lowBackground" 
                            image="club.svg"
                        >
                            {{ club }}
                        </menu-card>
                    </router-link>
                </div>
                <div class="p-3">
                    <router-link to="/clubHome">
                        <menu-card
                            bgColor="lowBackground" 
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
</script> -->
