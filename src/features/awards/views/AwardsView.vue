<template>
  <div class="p-2">
    <page-header has-back back-route="ClubHome" page-name="Awards" />
    <loading-spinner v-if="isLoading" />
    <div v-else>
      <v-select v-model="selectValue" :items="years" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from "vue";

import { useAwardYears } from "@/service/useAwards";
import { useClubId } from "@/service/useClub";

const clubId = useClubId();
const { data: years, isLoading } = useAwardYears(clubId);

const selectValue = ref<number>();
</script>
