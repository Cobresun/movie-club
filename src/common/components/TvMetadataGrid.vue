<template>
  <!-- Stacked label-over-value facts; the parent supplies the grid so these
       items flow into whatever column layout the drawer uses. -->
  <div v-if="hasValue(airDate)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">{{
      isEpisode ? "Aired" : "First aired"
    }}</span>
    <span class="text-sm text-gray-200">{{ formatDate(airDate) }}</span>
  </div>
  <div v-if="hasElements(creators)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">{{
      creators.length > 1 ? "Creators" : "Creator"
    }}</span>
    <span class="text-sm text-gray-200">{{ creators.join(", ") }}</span>
  </div>
  <div v-if="hasElements(networks)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">{{
      networks.length > 1 ? "Networks" : "Network"
    }}</span>
    <span class="text-sm text-gray-200">{{ networks.join(", ") }}</span>
  </div>
  <div v-if="hasValue(status)">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase">Status</span>
    <span class="text-sm text-gray-200">{{ status }}</span>
  </div>
</template>

<script setup lang="ts">
import { hasElements, hasValue } from "../../../lib/checks/checks.js";
import { formatDate } from "@/common/workDisplay";

defineProps<{
  airDate?: string;
  isEpisode: boolean;
  creators: string[];
  networks: string[];
  status?: string;
}>();
</script>
