<template>
  <div class="grid grid-cols-centerHeader items-center gap-x-2 sm:gap-x-8">
    <router-link
      v-if="hasBack"
      class="flex justify-end"
      :to="{ name: backRoute }"
    >
      <mdicon class="cursor-pointer" name="arrow-left" size="40" />
    </router-link>
    <div v-else />
    <h1 class="m-2 min-w-0 break-words text-2xl font-bold sm:m-4 sm:text-3xl">
      {{ hideClub ? "" : club?.clubName }} {{ pageName }}
    </h1>
    <slot />
  </div>
</template>
<script setup lang="ts">
import { useClub, useClubSlug } from "@/service/useClub";

const props = defineProps<{
  hasBack: boolean;
  backRoute?: string;
  pageName: string;
  hideClub?: boolean;
}>();

const { hideClub = false } = props;

// Only fetch club data if not hiding club
const clubId = hideClub ? "" : useClubSlug();
const { data: club } = hideClub ? { data: undefined } : useClub(clubId);
</script>
