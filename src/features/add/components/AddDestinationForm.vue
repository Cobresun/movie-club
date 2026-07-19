<template>
  <loading-spinner v-if="loading" class="self-center" />
  <div v-else class="flex flex-col items-center gap-2">
    <div class="flex items-center gap-2">
      <span class="font-medium">Add to:</span>
      <VSelect v-model="selectedTitle" :items="destinationTitles" />
    </div>
    <p v-if="duplicateInSelected" class="text-sm">
      Already in {{ selectedTitle }} —
      <router-link :to="viewRoute" class="text-primary hover:underline">
        view it
      </router-link>
    </p>
    <p v-else-if="hasElements(alsoIn)" class="text-sm text-gray-400">
      Also in {{ alsoIn.join(", ") }}
    </p>
    <v-btn :disabled="duplicateInSelected || isAdding" @click="handleAdd">
      Add {{ config.noun }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";

import {
  hasElements,
  hasValue,
  isDefined,
} from "../../../../lib/checks/checks";
import { ClubType } from "../../../../lib/types/generated/db";
import VSelect from "../../../common/components/VSelect.vue";
import { AddedPayload } from "../types";

import { clubTypeConfig, workTypeForClub } from "@/common/clubType";
import {
  useAddToList,
  useAllUserListItems,
  useClubLists,
  useReviewsList,
  useReviewsListId,
} from "@/service/useList";
import { WorkSearchResult } from "@/service/useMediaSearch";

const props = defineProps<{
  clubSlug: string;
  clubName: string;
  clubType: ClubType;
  work: WorkSearchResult;
}>();

const emit = defineEmits<{
  (e: "added", payload: AddedPayload): void;
}>();

const config = computed(() => clubTypeConfig(props.clubType));

const { data: reviewsListId, isLoading: reviewsIdLoading } = useReviewsListId(
  props.clubSlug,
);
const { data: lists, isLoading: listsLoading } = useClubLists(props.clubSlug);
const { data: reviewItems } = useReviewsList(props.clubSlug);
const { data: listItems } = useAllUserListItems(props.clubSlug);

const loading = computed(() => reviewsIdLoading.value || listsLoading.value);

const REVIEWS_LABEL = "Reviews";

interface DestinationOption {
  id: string;
  title: string;
  isReviews: boolean;
}

const destinations = computed<DestinationOption[]>(() => {
  const options: DestinationOption[] = [];
  if (hasValue(reviewsListId.value)) {
    options.push({
      id: reviewsListId.value,
      title: REVIEWS_LABEL,
      isReviews: true,
    });
  }
  for (const list of lists.value ?? []) {
    options.push({ id: list.id, title: list.title, isReviews: false });
  }
  return options;
});

const destinationTitles = computed(() =>
  destinations.value.map((destination) => destination.title),
);
const selectedTitle = shallowRef(REVIEWS_LABEL);
const selectedDestination = computed(() =>
  destinations.value.find(
    (destination) => destination.title === selectedTitle.value,
  ),
);

const reviewsDuplicate = computed(() =>
  (reviewItems.value ?? []).some(
    (item) => item.externalId === props.work.externalId,
  ),
);
const listDuplicates = computed(() =>
  (listItems.value ?? []).filter(
    (item) => item.externalId === props.work.externalId,
  ),
);

const duplicateInSelected = computed(() => {
  const destination = selectedDestination.value;
  if (!isDefined(destination)) return false;
  if (destination.isReviews) return reviewsDuplicate.value;
  return listDuplicates.value.some(
    (item) => item.sourceListId === destination.id,
  );
});

const alsoIn = computed(() => {
  const titles = new Set<string>();
  if (reviewsDuplicate.value) titles.add(REVIEWS_LABEL);
  for (const item of listDuplicates.value) titles.add(item.sourceListTitle);
  const destination = selectedDestination.value;
  if (isDefined(destination)) titles.delete(destination.title);
  return [...titles];
});

const viewRoute = computed(() => ({
  name:
    selectedDestination.value?.isReviews === false ? "Watchlists" : "Reviews",
  params: { clubSlug: props.clubSlug },
}));

const { mutate: addToList, isLoading: isAdding } = useAddToList(props.clubSlug);

const handleAdd = () => {
  const destination = selectedDestination.value;
  if (!isDefined(destination)) return;
  addToList(
    {
      listId: destination.id,
      insertDto: {
        type: workTypeForClub(props.clubType),
        title: props.work.title,
        externalId: props.work.externalId,
        imageUrl: props.work.imageUrl,
      },
    },
    {
      onSuccess: () =>
        emit("added", {
          clubSlug: props.clubSlug,
          clubName: props.clubName,
          listId: destination.id,
          isReviews: destination.isReviews,
          title: props.work.title,
        }),
    },
  );
};
</script>
