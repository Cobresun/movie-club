<template>
  <div class="grid items-center grid-cols-centerHeader gap-x-8">
    <router-link
      v-if="hasBack"
      class="flex justify-end"
      :to="{ name: backRoute }"
    >
      <mdicon class="cursor-pointer" name="arrow-left" size="40" />
    </router-link>
    <div v-else />
    <h1 class="text-3xl font-bold m-4">{{ club?.clubName }} {{ pageName }}</h1>
    <slot />
  </div>
</template>
<script setup lang="ts">
import { useClub, useClubId } from "@/service/useClub";

const { hasBack, backRoute, pageName } = defineProps<{
  hasBack: boolean;
  backRoute?: string;
  pageName: string;
}>();

const clubId = useClubId();
const { data: club } = useClub(clubId);
</script>
