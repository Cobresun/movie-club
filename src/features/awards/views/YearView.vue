<template>
  <div>
    <div
      v-if="isLoading"
      class="flex flex-col items-center"
      role="status"
      aria-label="Loading awards"
    >
      <SkeletonBlock class="m-4 h-8 w-40 rounded-lg" />
      <RowListSkeleton class="w-11/12 max-w-lg" :count="5" />
    </div>
    <div v-else-if="clubAward">
      <AwardsStepper class="mt-4" :step="clubAward.step" />
      <p class="mx-auto mt-4 w-11/12 max-w-lg text-sm text-gray-400">
        {{ AWARDS_PHASES[clubAward.step].description }}
      </p>
      <RouterView :club-award="clubAward" />
      <PhaseControls
        v-if="isDefined(AWARDS_PHASES[clubAward.step].next)"
        :club-award="clubAward"
        :club-slug="clubSlug"
        :year="year"
        :members="members ?? []"
      />
      <button
        type="button"
        class="mx-auto mt-6 flex items-center gap-1 text-sm text-gray-400 hover:text-red-400"
        @click="confirmingDelete = true"
      >
        <mdicon name="delete-outline" :size="18" />Delete {{ year }} awards
      </button>
      <DeleteConfirmationModal
        :show="confirmingDelete"
        :title="`Delete ${year} awards?`"
        :message="`This removes every category, nomination and vote for ${year}. It can't be undone.`"
        confirm-label="Delete"
        :loading="isDeleting"
        @cancel="confirmingDelete = false"
        @confirm="deleteYear"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, toRefs, watch } from "vue";
import { useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";
import AwardsStepper from "../components/AwardsStepper.vue";
import PhaseControls from "../components/PhaseControls.vue";
import { AWARDS_PHASES } from "../constants";
import DeleteConfirmationModal from "@/common/components/DeleteConfirmationModal.vue";
import RowListSkeleton from "@/common/components/RowListSkeleton.vue";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { useAwards, useDeleteAwardsYear } from "@/service/useAwards";
import { useMembers } from "@/service/useClub";

const props = defineProps<{ clubSlug: string; year: string }>();
const { clubSlug, year } = toRefs(props);

const router = useRouter();

const { data: clubAward, isLoading } = useAwards(clubSlug, year);
const { data: members } = useMembers(clubSlug);

// Whoever moves the year along, everyone lands on the page for its phase.
// Replace: a year on its own renders nothing, so it must not be a history
// entry the back button can land on.
const phaseRoute = computed(() =>
  isDefined(clubAward.value) ? AWARDS_PHASES[clubAward.value.step].routeName : undefined,
);
watch(
  phaseRoute,
  (name) => {
    if (isDefined(name)) router.replace({ name }).catch(console.error);
  },
  { immediate: true },
);

const confirmingDelete = ref(false);
const { mutate: deleteMutation, isLoading: isDeleting } = useDeleteAwardsYear(
  props.clubSlug,
  props.year,
);
const deleteYear = () =>
  deleteMutation(undefined, {
    onSuccess: () => {
      confirmingDelete.value = false;
      router.push({ name: "Awards" }).catch(console.error);
    },
  });
</script>
