<template>
  <section class="flex flex-col">
    <SectionHeader title="Club settings" />

    <div class="flex flex-col overflow-hidden rounded-xl bg-lowBackground">
      <ClubEditableRow
        v-model:editing="isEditingName"
        label="Club name"
        input-id="club-name"
        :value="club?.clubName ?? ''"
        :error="nameError"
        :saving="isSavingName"
        :maxlength="100"
        @save="saveName"
        @dirty="nameError = ''"
      />

      <ClubEditableRow
        v-model:editing="isEditingSlug"
        label="Club link"
        input-id="club-slug"
        highlight-value
        warn-hint
        :prefix="urlPrefix"
        :value="currentSlug"
        :error="slugError"
        :saving="isSavingSlug"
        placeholder="your-club-name"
        hint="Changing this breaks existing links to your club."
        @save="saveSlug"
        @dirty="slugError = ''"
      />

      <div
        v-for="feature in FEATURES"
        :key="feature.key"
        class="flex min-h-[56px] items-start gap-3 border-t border-white/[0.08] px-4 py-3.5"
      >
        <span class="flex min-w-0 flex-grow flex-col gap-1">
          <span class="text-[15px] font-medium">{{ feature.title }}</span>
          <span class="text-xs leading-relaxed text-white/50">{{ feature.description }}</span>
          <span class="flex items-center gap-1.5 text-[11px] text-yellow-500">
            <mdicon name="alert-outline" :size="13" />
            <span>Experimental</span>
          </span>
        </span>
        <v-switch
          :model-value="isEnabled(feature.key)"
          color="primary"
          :aria-label="feature.title"
          class="mt-0.5 flex-shrink-0"
          @update:model-value="updateFeature(feature.key, $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AxiosError } from "axios";
import { computed, ref } from "vue";
import { useToast } from "vue-toastification";

import { hasValue } from "../../../../lib/checks/checks.js";
import ClubEditableRow from "./ClubEditableRow.vue";
import SectionHeader from "@/common/components/SectionHeader.vue";
import {
  useClub,
  useClubSettings,
  useUpdateClubName,
  useUpdateClubSettings,
  useUpdateClubSlug,
} from "@/service/useClub";

const { clubSlug } = defineProps<{ clubSlug: string }>();

type FeatureKey = "awards" | "discussionQuestions";

const FEATURES: readonly { key: FeatureKey; title: string; description: string }[] = [
  {
    key: "awards",
    title: "Awards",
    description: "Season awards, ballots and winners for this club.",
  },
  {
    key: "discussionQuestions",
    title: "AI discussion questions",
    description: "Adds a button on each review that drafts questions to spark conversation.",
  },
];

const SLUG_PATTERN = /^[a-z0-9-]+$/;

const toast = useToast();

const { data: club } = useClub(clubSlug);
const { data: settings } = useClubSettings(clubSlug);
const { mutate: updateName, isPending: isSavingName } = useUpdateClubName(clubSlug);
const { mutate: updateSlug, isPending: isSavingSlug } = useUpdateClubSlug(clubSlug);
const { mutate: updateSettings } = useUpdateClubSettings(clubSlug);

const isEditingName = ref(false);
const nameError = ref("");
const isEditingSlug = ref(false);
const slugError = ref("");

const currentSlug = computed(() => club.value?.slug ?? clubSlug);
const urlPrefix = computed(() => `${window.location.origin}/club/`);

const isEnabled = (key: FeatureKey) => settings.value?.features?.[key] === true;

const updateFeature = (key: FeatureKey, value: boolean) => {
  const features: Partial<Record<FeatureKey, boolean>> = { [key]: value };
  updateSettings(
    { features },
    {
      onSuccess: () => toast.success("Settings updated successfully"),
      onError: () => toast.error("Failed to update settings"),
    },
  );
};

const saveName = (name: string) => {
  if (!hasValue(name)) {
    nameError.value = "Name cannot be empty";
    return;
  }
  if (name === club.value?.clubName) {
    isEditingName.value = false;
    return;
  }

  updateName(name, {
    onSuccess: () => {
      toast.success("Club name updated successfully");
      isEditingName.value = false;
    },
    onError: () => {
      nameError.value = "Failed to update club name";
    },
  });
};

const validateSlug = (slug: string): string | null => {
  if (slug.length < 3 || slug.length > 50) return "Link must be 3-50 characters";
  if (!SLUG_PATTERN.test(slug)) return "Only lowercase letters, numbers, and hyphens allowed";
  if (/^[0-9]+$/.test(slug)) return "Link cannot be all numbers";
  return null;
};

const saveSlug = (slug: string) => {
  if (slug === currentSlug.value) {
    isEditingSlug.value = false;
    return;
  }

  const validationError = validateSlug(slug);
  if (hasValue(validationError)) {
    slugError.value = validationError;
    return;
  }

  updateSlug(slug, {
    onSuccess: () => {
      toast.success("Club link updated successfully");
      isEditingSlug.value = false;
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ error?: string }>;
      const message = axiosError.response?.data?.error ?? "Failed to update link";
      slugError.value = message;
      toast.error(message);
    },
  });
};
</script>
