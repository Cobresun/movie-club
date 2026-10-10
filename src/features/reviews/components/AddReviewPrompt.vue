<template>
  <v-modal size="lg" @close="emit('close')">
    <WorkSearchSkeleton v-if="loading" />
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
import WorkSearchSkeleton from "../../../common/components/WorkSearchSkeleton.vue";
import { workSubtitle, workTypeForClub } from "@/common/clubType";
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

const { data: listItems, isLoading: listsLoading } = useAllUserListItems(clubId);
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

const { mutate: queueReview } = useQueueReview(clubId);
const { mutate: addFromSearch } = useAddToReviewsList(clubId);

// Both writes put the work on the reviews page optimistically, so the prompt
// closes on the pick rather than on the round trip.
const selectFromDefault = (work: WorkSearchResult) => {
  const sourceItem = listItems.value?.find((item) => item.externalId === work.externalId);
  if (!sourceItem || !hasValue(reviewsListId.value)) return;
  queueReview({
    workId: sourceItem.id,
    sourceListId: sourceItem.sourceListId,
    reviewsListId: reviewsListId.value,
  });
  emit("close");
};

const selectFromSearch = (work: WorkSearchResult) => {
  if (!hasValue(reviewsListId.value)) return;
  addFromSearch({
    insertDto: {
      type: workTypeForClub(clubType.value),
      title: work.title,
      externalId: work.externalId,
      imageUrl: work.imageUrl,
    },
    reviewsListId: reviewsListId.value,
  });
  emit("close");
};

const loading = computed(() => listsLoading.value || !club.value);
</script>
