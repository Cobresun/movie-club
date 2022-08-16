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
          :key="club.clubId"
          class="p-3"
        >
          <router-link :to="{ name: 'ClubHome', params: { clubId: club.clubId }}">
            <menu-card
              bg-color="lowBackground"
              :image="clubSvg"
            >
              {{ club.clubName }}
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
import { ClubsViewClub } from "../models"

import clubSvg from "@/assets/menu-images/club.svg";
import { useUser } from "@/data/useUser";

const store = useStore();

const loading = ref(true);
const isLoggedIn = computed(() => store.getters['auth/isLoggedIn']);

const clubs = ref<ClubsViewClub[]>([]);
const { user } = useUser();

const loadClubs = async () => {
  if (user.value) {
    const promises: Promise<ClubsViewClub>[] = [];
    user.value.clubs.forEach((clubId: number) => {
      promises.push(
        axios
          .get<ClubsViewClub>(`/api/club/${clubId}`)
          .then((response) => {
              return response.data;
            })
      );
    });

    clubs.value = await Promise.all(promises);
    loading.value = false;
  }
}

watch(user, loadClubs);
loadClubs();
</script>
