<template>
    <div class="clubs">
        <div class="club-option">
            <router-link to="/clubHome">
                <menu-card 
                    bgColor="var(--low-key-background-color)" 
                    image="club.svg"
                >
                    Cobresun
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
</template>

<script lang="ts">
    import { Component, Vue } from 'vue-property-decorator'

    @Component({})

    export default class ClubsView extends Vue {
        
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
