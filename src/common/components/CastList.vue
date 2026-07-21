<template>
  <section v-if="hasElements(allActors)">
    <SectionHeader title="Cast">
      <button v-if="hasMore" class="text-xs text-primary hover:underline" @click="showAll = true">
        See all ({{ allActors.length }})
      </button>
    </SectionHeader>

    <ul class="flex gap-4 overflow-x-auto pb-1">
      <li
        v-for="(actor, index) in visibleActors"
        :key="`${actor.name}-${index}`"
        class="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"
      >
        <CastAvatar :name="actor.name" :profile-path="actor.profilePath" :size="64" />
        <span class="line-clamp-2 text-xs leading-tight text-gray-300">
          {{ actor.name }}
        </span>
        <span
          v-if="hasValue(actor.character)"
          class="line-clamp-2 text-[0.65rem] leading-tight text-gray-500"
        >
          {{ actor.character }}
        </span>
      </li>

      <li v-if="hasMore" class="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
        <button
          class="flex h-16 w-16 items-center justify-center rounded-full bg-lowBackground text-sm font-medium text-gray-300 transition hover:brightness-110"
          @click="showAll = true"
        >
          +{{ remainingCount }}
        </button>
        <span class="text-xs leading-tight text-gray-400">More</span>
      </li>
    </ul>

    <CastModal v-if="showAll" :actors="allActors" @close="showAll = false" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasElements, hasValue } from "../../../lib/checks/checks";
import CastAvatar from "./CastAvatar.vue";
import CastModal from "./CastModal.vue";
import SectionHeader from "./SectionHeader.vue";

const props = defineProps<{
  actors?: {
    name: string;
    character: string | null;
    profilePath: string | null;
  }[];
}>();

const VISIBLE_ACTORS_COUNT = 5;

const allActors = computed(() => props.actors ?? []);
const visibleActors = computed(() => allActors.value.slice(0, VISIBLE_ACTORS_COUNT));
const hasMore = computed(() => allActors.value.length > VISIBLE_ACTORS_COUNT);
const remainingCount = computed(() => allActors.value.length - VISIBLE_ACTORS_COUNT);

const showAll = ref(false);
</script>
