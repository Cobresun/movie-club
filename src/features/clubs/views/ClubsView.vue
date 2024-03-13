<template>
  <div>
    <div v-if="!isLoggedIn">Need to be logged in!</div>

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
import { useUserClubs } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { data: clubs, isLoading } = useUserClubs();
</script>
