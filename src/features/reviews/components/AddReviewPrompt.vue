<template>
  <v-modal size="lg" @close="emit('close')">
    <loading-spinner v-if="loading" class="self-center" />
    <WorkSearchPrompt
      v-else
      :club-type="clubType"
      default-list-title="From your lists"
      :default-list="combinedListSearchIndex"
      @close="emit('close')"
      @select-from-default="selectFromDefault"
      @select-from-search="selectFromSearch"
    />
  </v-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../../lib/checks/checks";
import { ClubType } from "../../../../lib/types/generated/db";
import WorkSearchPrompt from "../../../common/components/WorkSearchPrompt.vue";

import { workTypeForClub } from "@/common/clubType";
import { workSubtitle } from "@/common/workDisplay";
import { useClub, useClubSlug } from "@/service/useClub";
import {
  useAddToReviewsList,
  useAllUserListItems,
  useQueueReview,
  useReviewsListId,
} from "@/service/useList";
import { WorkSearchResult } from "@/service/useMediaSearch";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const clubId = useClubSlug();
const { data: club } = useClub(clubId);
const clubType = computed(() => club.value?.type ?? ClubType.movie);

const { data: listItems, isLoading: listsLoading } =
  useAllUserListItems(clubId);
const { data: reviewsListId } = useReviewsListId(clubId);

const combinedListSearchIndex = computed<WorkSearchResult[]>(
  () =>
    listItems.value?.map((item) => ({
      externalId: item.externalId ?? "",
      title: item.title,
      subtitle: workSubtitle(item.externalData),
      imageUrl: item.imageUrl,
    })) ?? [],
);

const { mutateAsync: queueReview, isLoading: queueLoading } =
  useQueueReview(clubId);
const { mutateAsync: addFromSearch, isLoading: addLoading } =
  useAddToReviewsList(clubId);

const selectFromDefault = async (work: WorkSearchResult) => {
  const sourceItem = listItems.value?.find(
    (item) => item.externalId === work.externalId,
  );
  if (!sourceItem || !hasValue(reviewsListId.value)) return;
  await queueReview(
    {
      workId: sourceItem.id,
      sourceListId: sourceItem.sourceListId,
      reviewsListId: reviewsListId.value,
    },
    { onSuccess: () => emit("close") },
  );
};

const selectFromSearch = async (work: WorkSearchResult) => {
  if (!hasValue(reviewsListId.value)) return;
  await addFromSearch(
    {
      insertDto: {
        type: workTypeForClub(clubType.value),
        title: work.title,
        externalId: work.externalId,
        imageUrl: work.imageUrl,
      },
      reviewsListId: reviewsListId.value,
    },
    { onSuccess: () => emit("close") },
  );
};

const loading = computed(
  () =>
    listsLoading.value || queueLoading.value || addLoading.value || !club.value,
);
</script>
