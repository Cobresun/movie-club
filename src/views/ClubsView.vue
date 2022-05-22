<template>
  <div>
    <div v-if="!isLoggedIn">
      Need to be logged in!
    </div>

    <div v-if="isLoggedIn">
      <loading-spinner v-if="loading" />

      <div
        v-else
        class="flex justify-center pb-6 flex-col md:flex-row"
      >
        <div
          v-for="club in clubs"
          :key="club"
          class="p-3"
        >
          <router-link to="/club-home">
            <menu-card
              bg-color="lowBackground"
              :image="clubSvg"
            >
              {{ club }}
            </menu-card>
          </router-link>
        </div>
        <div class="p-3">
          <router-link to="/club-home">
            <menu-card
              bg-color="lowBackground"
              :image="clubSvg"
            >
              + New Club
            </menu-card>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStore } from "vuex";
import axios from "axios";
import { Club } from "../models"

import clubSvg from "@/assets/menu-images/club.svg";

const store = useStore();

const loading = ref(true);
const isLoggedIn = computed(() => store.state.auth.user);

const clubs = ref<string[]>([]);
const getClubs = (newVal: boolean) => {
  if (newVal) {
    axios
      .get(`/api/member/${store.state.auth.user.email}`)
      .then(async (response) => {
        const promises: Promise<string>[] = [];

        response.data.clubs.forEach((clubId: number) => {
          promises.push(
            axios
              .get<Club>(`/api/club/${clubId}`)
              .then((response) => {
                console.log(response.data)
                return response.data.clubName;
              }
            )
          );
        });

        clubs.value = await Promise.all(promises);
        loading.value = false;
      });
  }
};

watch(isLoggedIn, getClubs);

getClubs(isLoggedIn.value);
</script>
