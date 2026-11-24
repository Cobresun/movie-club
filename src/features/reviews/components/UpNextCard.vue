<template>
  <section
    v-if="isDefined(upNext)"
    aria-label="Up next"
    class="border-highlightBackground bg-lowBackground mb-4 flex items-center gap-3 rounded-lg border-2 p-3 text-left md:mx-6"
  >
    <PosterImage :image-url="upNext.imageUrl" :alt="upNext.title" class="w-14 shrink-0" />
    <div class="min-w-0 grow">
      <p
        class="text-highlightBackground flex items-center gap-1 text-xs font-semibold tracking-wide uppercase"
      >
        <mdicon name="arrow-collapse-up" size="14" />
        <span>Up next</span>
      </p>
      <h2 class="truncate font-semibold">{{ upNext.title }}</h2>
      <p class="truncate text-sm text-gray-400">
        <span v-if="hasValue(subtitle)">{{ subtitle }} · </span>
        <span>From {{ upNext.sourceListTitle }}</span>
      </p>
    </div>
    <v-btn
      class="shrink-0"
      :disabled="isDefined(startingItem)"
      :aria-label="isDefined(startingItem) ? `Adding ${upNext.title}` : `Review ${upNext.title}`"
      @click="startReview(upNext)"
    >
      <mdicon v-if="isDefined(startingItem)" name="loading" size="20" class="animate-spin" />
      <mdicon v-else name="star" size="20" />
      <span class="ml-1">{{ isDefined(startingItem) ? "Adding…" : "Review" }}</span>
    </v-btn>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { hasValue, isDefined } from "../../../../lib/checks/checks";
import { UserListItemWithSource } from "../../../../lib/types/lists";
import { workSubtitle } from "@/common/clubType";
import PosterImage from "@/common/components/PosterImage.vue";
import { useReviewsListId } from "@/service/useClub";
import { useNextWorkItem, useQueueReview, useReviewsList } from "@/service/useList";

const { clubSlug } = defineProps<{ clubSlug: string }>();

const emit = defineEmits<{
  started: [workId: string];
}>();

const toast = useToast();

const { data: nextWork } = useNextWorkItem(clubSlug);
const { data: reviews } = useReviewsList(clubSlug);
const reviewsListId = useReviewsListId(clubSlug);
const { mutateAsync: queueReview } = useQueueReview(clubSlug);

const nextItem = computed(() => {
  const work = nextWork.value;
  if (!isDefined(work)) return undefined;
  if (reviews.value?.some((review) => review.id === work.id) === true) return undefined;
  return work;
});

// Hold on to the work while it moves so the card stays up, visibly pending,
// until the review exists to open.
const startingItem = ref<UserListItemWithSource>();
const upNext = computed(() => startingItem.value ?? nextItem.value);

const subtitle = computed(() => workSubtitle(upNext.value?.externalData));

const startReview = async (item: UserListItemWithSource) => {
  if (!hasValue(reviewsListId.value) || isDefined(startingItem.value)) return;
  startingItem.value = item;
  try {
    await queueReview({
      workId: item.id,
      sourceListId: item.sourceListId,
      reviewsListId: reviewsListId.value,
    });
    emit("started", item.id);
  } catch {
    toast.error(`Failed to add "${item.title}" to reviews. Please try again.`);
  } finally {
    startingItem.value = undefined;
  }
};
</script>
