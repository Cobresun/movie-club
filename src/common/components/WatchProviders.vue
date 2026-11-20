<template>
  <!--
    v-show (not v-if): keeps a real root element so a fallthrough `class`
    (e.g. md:col-span-2 from the grid parents) attaches cleanly. When there
    are no providers the element is display:none, so it adds no grid gap.
  -->
  <div v-show="hasElements(providers)" class="flex flex-col gap-1.5">
    <span class="block text-xs font-medium tracking-wide text-gray-500 uppercase"
      >Where to watch</span
    >
    <a
      v-if="hasValue(justWatchLink)"
      :href="justWatchLink"
      target="_blank"
      rel="noopener noreferrer"
      class="flex flex-wrap items-center gap-2"
    >
      <img
        v-for="provider in providers"
        :key="provider.provider_id"
        v-lazy-load
        :src="logoUrl(provider.logo_path)"
        :alt="provider.provider_name"
        :title="provider.provider_name"
        class="h-8 w-8 rounded-md"
      />
    </a>
    <span class="text-xs text-gray-500">Powered by JustWatch</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks";
import { type WorkType } from "../../../lib/types/generated/db";
import { workWatchProvidersPath } from "@/common/clubType";
import { streamingServices, viewerAvailability } from "@/common/streamingServices";
import { useWatchProviders } from "@/service/useTMDB";

const { type, externalId = "" } = defineProps<{
  type: WorkType;
  externalId?: string;
}>();

// A work type with no availability source never fetches, so the section stays hidden.
const { data } = useWatchProviders(() => workWatchProvidersPath(type, externalId));

const availability = computed(() => viewerAvailability(data.value));

const providers = computed(() => streamingServices(availability.value));

const justWatchLink = computed(() => availability.value?.link);

const logoUrl = (logoPath: string) => `https://image.tmdb.org/t/p/w92${logoPath}`;
</script>
