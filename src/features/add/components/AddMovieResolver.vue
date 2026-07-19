<template>
  <loading-spinner v-if="findLoading" class="self-center" />
  <AddConfirmCard
    v-else-if="isDefined(confirmedWork)"
    :key="confirmedWork.externalId"
    :work="confirmedWork"
    :work-type="target.workType"
    :is-logged-in="isLoggedIn"
    :clubs="clubs"
    :can-reselect="!isDefined(imdbMatch)"
    @added="emit('added', $event)"
    @login="emit('login')"
    @reselect="selected = undefined"
  />
  <AddSearchFallback
    v-else-if="hasValue(target.title)"
    :work-type="target.workType"
    :title="target.title"
    :year="target.year"
    @select="selected = $event"
  />
  <EmptyState
    v-else
    title="Nothing to add"
    description="This link didn't include enough to identify a movie. Try the search on your club's page instead."
  />
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";

import {
  hasElements,
  hasValue,
  isDefined,
} from "../../../../lib/checks/checks";
import { ClubPreview } from "../../../../lib/types/club";
import EmptyState from "../../../common/components/EmptyState.vue";
import { AddLinkTarget } from "../addLink";
import { AddedPayload } from "../types";
import AddConfirmCard from "./AddConfirmCard.vue";
import AddSearchFallback from "./AddSearchFallback.vue";

import { movieToSearchResult } from "@/common/clubType";
import { WorkSearchResult } from "@/service/useMediaSearch";
import { useFindByImdbId } from "@/service/useTMDB";

const props = defineProps<{
  target: AddLinkTarget;
  isLoggedIn: boolean;
  clubs: ClubPreview[];
}>();

const emit = defineEmits<{
  (e: "added", payload: AddedPayload): void;
  (e: "login"): void;
}>();

const imdbId = computed(() => props.target.imdbId);
const { data: findData, isInitialLoading: findLoading } =
  useFindByImdbId(imdbId);

const imdbMatch = computed(() => {
  const results = findData.value?.movie_results;
  return hasElements(results) ? movieToSearchResult(results[0]) : undefined;
});

// Set when the user picks a result from the fallback search grid.
const selected = shallowRef<WorkSearchResult | undefined>(undefined);

const confirmedWork = computed(() => imdbMatch.value ?? selected.value);
</script>
