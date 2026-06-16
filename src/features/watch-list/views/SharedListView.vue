<template>
  <div class="relative min-h-screen pb-24">
    <SharedPageHeader
      :club-name="club?.clubName ?? clubSlug"
      :members="members"
      :subtitle="listTitle"
    />

    <div class="mx-auto max-w-6xl space-y-6 px-6 pt-6">
      <loading-spinner v-if="isLoading" />
      <div v-else-if="error" class="rounded-lg bg-red-900/50 p-4">
        <p class="text-center text-red-400">Failed to load list</p>
      </div>

      <EmptyState
        v-else-if="!hasElements(sortedItems)"
        title="List is Empty"
        description="This list is empty."
      />

      <div v-else class="grid grid-cols-auto justify-items-center">
        <div v-for="item in sortedItems" :key="item.id" class="relative">
          <div
            v-if="item.id === nextWorkId"
            class="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-highlightBackground px-3 py-0.5 text-xs font-semibold text-white shadow"
          >
            Next Up
          </div>
          <WorkPosterCard
            :title="item.title"
            :poster-url="item.imageUrl ?? ''"
            :highlighted="item.id === nextWorkId"
          >
            <div
              v-if="isDefined(adderFor(item))"
              class="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400"
              :title="`Added by ${adderFor(item)?.name}`"
            >
              <VAvatar
                :src="adderFor(item)?.image"
                :name="adderFor(item)?.name ?? ''"
                :size="18"
              />
              <span class="truncate">{{ adderFor(item)?.name }}</span>
            </div>
          </WorkPosterCard>
        </div>
      </div>
    </div>

    <SharedPageCtaBanner />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import {
  hasElements,
  hasValue,
  isDefined,
} from "../../../../lib/checks/checks.js";
import { DetailedWorkListItem } from "../../../../lib/types/lists.js";

import EmptyState from "@/common/components/EmptyState.vue";
import SharedPageCtaBanner from "@/common/components/SharedPageCtaBanner.vue";
import SharedPageHeader from "@/common/components/SharedPageHeader.vue";
import VAvatar from "@/common/components/VAvatar.vue";
import WorkPosterCard from "@/common/components/WorkPosterCard.vue";
import { useClub, useMembers } from "@/service/useClub";
import { useClubLists, useList, useNextWork } from "@/service/useList";

const route = useRoute();
const clubSlug = route.params.clubSlug as string;
const listId = route.params.listId as string;

const { data: club } = useClub(clubSlug);
const { data: rawMembers } = useMembers(clubSlug);
const members = computed(() => rawMembers.value ?? []);
const { data: lists } = useClubLists(clubSlug);
const { data: items, isLoading, error } = useList(clubSlug, listId);
const { data: nextWorkId } = useNextWork(clubSlug);

const listTitle = computed(
  () => lists.value?.find((l) => l.id === listId)?.title ?? "List",
);

const memberById = computed(() => new Map(members.value.map((m) => [m.id, m])));
const adderFor = (item: DetailedWorkListItem) =>
  hasValue(item.addedBy) ? memberById.value.get(item.addedBy) : undefined;

const sortedItems = computed(() => {
  const list = items.value ?? [];
  const next = list.find((i) => i.id === nextWorkId.value);
  return next ? [next, ...list.filter((i) => i.id !== next.id)] : list;
});
</script>
