<template>
  <div class="flex flex-col items-center gap-4">
    <div class="flex items-start gap-4">
      <img
        v-if="hasValue(work.imageUrl)"
        :src="work.imageUrl"
        :alt="work.title"
        class="w-32 rounded-lg"
      />
      <div
        v-else
        class="flex h-48 w-32 items-center justify-center rounded-lg bg-slate-700"
      >
        <mdicon :name="config.icon" :size="48" class="text-slate-400" />
      </div>
      <div>
        <h2 class="text-2xl font-bold">{{ work.title }}</h2>
        <p v-if="hasValue(work.subtitle)" class="text-gray-400">
          {{ work.subtitle }}
        </p>
        <button
          v-if="canReselect"
          class="mt-2 text-sm text-primary hover:underline"
          @click="emit('reselect')"
        >
          Not the right {{ config.noun }}? Choose another
        </button>
      </div>
    </div>

    <template v-if="!isLoggedIn">
      <p>Log in to add this {{ config.noun }} to a club.</p>
      <v-btn @click="emit('login')">Log In</v-btn>
    </template>
    <div v-else-if="!hasElements(clubs)" class="text-center">
      <p class="mb-2">You're not in any {{ clubNoun }}s yet.</p>
      <router-link
        :to="{ name: 'NewClub' }"
        class="text-primary hover:underline"
      >
        Create one
      </router-link>
    </div>
    <template v-else>
      <div class="flex items-center gap-2">
        <span class="font-medium">Club:</span>
        <VSelect v-model="selectedClubName" :items="clubNames" />
      </div>
      <AddDestinationForm
        v-if="isDefined(selectedClub)"
        :key="selectedClub.slug"
        :club-slug="selectedClub.slug"
        :club-name="selectedClub.clubName"
        :club-type="selectedClub.type"
        :work="work"
        @added="emit('added', $event)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue";

import AddDestinationForm from "./AddDestinationForm.vue";
import {
  hasElements,
  hasValue,
  isDefined,
} from "../../../../lib/checks/checks";
import { ClubPreview } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import VSelect from "../../../common/components/VSelect.vue";
import { AddedPayload } from "../types";

import { clubTypeConfigForWorkType } from "@/common/clubType";
import { resolveDefaultClubSlug } from "@/common/composables/useLastClubSlug";
import { WorkSearchResult } from "@/service/useMediaSearch";

const props = defineProps<{
  work: WorkSearchResult;
  workType: WorkType;
  isLoggedIn: boolean;
  clubs: ClubPreview[];
  canReselect?: boolean;
}>();

const emit = defineEmits<{
  (e: "added", payload: AddedPayload): void;
  (e: "login"): void;
  (e: "reselect"): void;
}>();

const config = computed(() => clubTypeConfigForWorkType(props.workType));
const clubNoun = computed(() => config.value.label.toLowerCase());

const clubNames = computed(() => props.clubs.map((club) => club.clubName));

const defaultClubName = () => {
  const slug = resolveDefaultClubSlug(props.clubs);
  const club = props.clubs.find((candidate) => candidate.slug === slug);
  return club?.clubName ?? props.clubs[0]?.clubName ?? "";
};
const selectedClubName = shallowRef(defaultClubName());

const selectedClub = computed(() =>
  props.clubs.find((club) => club.clubName === selectedClubName.value),
);
</script>
