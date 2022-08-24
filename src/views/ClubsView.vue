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
import { computed, reactive, watch } from "vue";
import { useStore } from "vuex";

import clubSvg from "@/assets/menu-images/club.svg";
import { useUser } from "@/data/useUser";
import { useClub } from "@/data/useClub";
import { ClubsViewClub, DataService } from "@/models";

const store = useStore();
const isLoggedIn = computed(() => store.getters['auth/isLoggedIn']);

const { data: user, loading: userLoading } = useUser();

const clubServiceResults = reactive<DataService<ClubsViewClub>[]>([]);

const setClubs = (isLoading: boolean) => {
  if (isLoading || !user.value) return;
  clubServiceResults.length = 0;
  user.value.clubs.forEach((club) => 
    clubServiceResults.push(reactive(useClub(club.toString())))
  );
}
watch(userLoading, setClubs);
setClubs(userLoading.value);

const loading = computed(() => {
  return userLoading.value || clubServiceResults.some(result => result.loading);
});

const clubs = computed(() => {
  if (loading.value) return [];
  return clubServiceResults.map(result => result.data);
});
</script>
