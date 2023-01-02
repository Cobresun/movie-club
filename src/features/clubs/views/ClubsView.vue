<template>
  <div>
    <div v-if="!isLoggedIn">Need to be logged in!</div>

    <div v-if="isLoggedIn">
      <loading-spinner v-if="loading" />
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
        
        <router-link
          class="p-3"
          :to="{ name: 'NewClub' }"
        >
          <!-- TODO: use a different image for the create club button -->
          <menu-card bg-color="lowBackground" :image="clubSvg">
            Create new club
          </menu-card>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";

import clubSvg from "@/assets/images/menu-images/club.svg";
import { ClubsViewClub, CacheDataService } from "@/common/types/models";
import { useClub } from "@/service/useClub";
import { useUser } from "@/service/useUser";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { data: user, loading: userLoading } = useUser();

const clubServiceResults = reactive<CacheDataService<ClubsViewClub>[]>([]);

const loading = computed(() => {
  return (
    userLoading.value || clubServiceResults.some((result) => result.loading)
  );
});

const clubs = computed<ClubsViewClub[]>(() =>
  clubServiceResults
    .map((result) => result.data)
    .filter((result): result is ClubsViewClub => !!result)
);

const setClubs = (isLoading: boolean) => {
  if (isLoading || loading.value || !user.value) return;
  clubServiceResults.length = 0;
  user.value.clubs.forEach((club) =>
    clubServiceResults.push(reactive(useClub(club.toString())))
  );
};
watch(userLoading, setClubs);
setClubs(userLoading.value);
</script>
