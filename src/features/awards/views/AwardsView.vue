<template>
  <div class="p-2 flex justify-center">
    <div class="w-full max-w-4xl text-center">
      <page-header has-back back-route="ClubHome" page-name="Awards" />
      <loading-spinner v-if="isLoading" />
      <div v-else>
        <v-select v-model="selectValue" :items="selectYears" />
        <RouterView />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAwardYears } from "@/service/useAwards";
import { useClubId } from "@/service/useClub";

const clubId = useClubId();
const { data: years, isLoading } = useAwardYears(clubId);

const selectYears = computed(() =>
  years.value ? years.value.map((year) => year.toString()) : []
);

const route = useRoute();
const router = useRouter();

const selectValue = computed({
  get() {
    return route.params.year ? (route.params.year as string) : "";
  },
  set(value: string) {
    router.push({ name: "AwardsYear", params: { year: value } });
  },
});
</script>
