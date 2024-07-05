<template>
  <div>
    <div v-if="!isLoggedIn" class="flex flex-col space-y-10 px-10 py-10 md:px-48 md:py-48 md:space-x-14 md:flex-row-reverse">
      <div class="flex-grow-0">
        <img
          :src="homeCinemaSvg"
        />
      </div>

      <div class="flex flex-col text-left space-y-8">
        <h1 class="text-3xl md:text-5xl font-bold leading-tight">Get your 🍿 ready for MovieClub: The Book Club for Movies</h1>
        <h2 class="text-1xl md:text-2xl font-light">Rate movies, compare favorites, and find patterns.</h2>
      </div>
    </div>
    
    <div v-if="isLoggedIn">
      <loading-spinner v-if="isLoading" />
      <div v-else class="flex justify-center pb-6 flex-col md:flex-row">
        <div v-for="club in clubs" :key="club.clubId" class="p-3">
          <router-link
            :to="{ name: 'ClubHome', params: { clubId: club.clubId } }"
          >
            <menu-card bg-color="lowBackground" :image="clubSvg">
              {{ club.clubName }}
            </menu-card>
          </router-link>
        </div>

        <router-link class="p-3" :to="{ name: 'NewClub' }">
          <!-- TODO: use a different image for the create club button -->
          <!-- <menu-card bg-color="lowBackground" :image="clubSvg">
            Create new club
          </menu-card> -->
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import clubSvg from "@/assets/images/menu-images/club.svg";
import homeCinemaSvg from "@/assets/images/home_cinema.svg"
import { useUserClubs } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { data: clubs, isLoading } = useUserClubs();
</script>
