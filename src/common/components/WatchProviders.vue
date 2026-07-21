<template>
  <!--
    v-show (not v-if): keeps a real root element so a fallthrough `class`
    (e.g. md:col-span-2 from the grid parents) attaches cleanly. When there
    are no providers the element is display:none, so it adds no grid gap.
  -->
  <div v-show="hasElements(providers)" class="flex flex-col gap-1.5">
    <span class="block text-xs font-medium uppercase tracking-wide text-gray-500"
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
import { computed, toRef } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks";
import { TMDBWatchProvider } from "../../../lib/types/movie";
import { useWatchProviders } from "@/service/useTMDB";

const props = defineProps<{
  externalId?: string;
}>();

// The user's region drives which availability we show. We never fall back to
// another country's data: if the locale has no region subtag, or TMDB has no
// entry for it, `providers` stays empty and the whole section is hidden.
const region = detectRegion();

function detectRegion(): string | undefined {
  if (typeof navigator === "undefined" || !hasValue(navigator.language)) {
    return undefined;
  }
  try {
    return new Intl.Locale(navigator.language).region ?? undefined;
  } catch {
    return undefined;
  }
}

const { data } = useWatchProviders(toRef(props, "externalId"));

const regionData = computed(() => (hasValue(region) ? data.value?.results[region] : undefined));

// "Where to watch" shows only subscription streaming services (TMDB's
// `flatrate` bucket). Free/ad-supported and paid rent/buy are intentionally
// excluded — these are the services you can actually stream the movie on.
// Ordered by TMDB's display priority.
const providers = computed<TMDBWatchProvider[]>(() =>
  [...(regionData.value?.flatrate ?? [])].sort((a, b) => a.display_priority - b.display_priority),
);

const justWatchLink = computed(() => regionData.value?.link);

const logoUrl = (logoPath: string) => `https://image.tmdb.org/t/p/w92${logoPath}`;
</script>
