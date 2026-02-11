<template>
  <div>
    <page-header page-name="Club Settings" has-back back-route="ClubHome" />

    <div class="mx-auto max-w-3xl px-4 pb-6">
      <!-- Club Name Section -->
      <div class="mt-6 space-y-4">
        <h3 class="text-xl font-semibold">Club Name</h3>
        <div class="rounded-lg bg-gray-800 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <label
                for="club-name"
                class="mb-2 block text-sm font-medium text-gray-300"
              >
                Name
              </label>
              <input
                id="club-name"
                v-model="editedClubName"
                type="text"
                maxlength="100"
                class="w-full rounded border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                :disabled="isSavingName"
              />
            </div>
            <v-btn
              class="h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
              :loading="isSavingName"
              :disabled="!hasNameChanged || isSavingName"
              @click="saveClubName"
            >
              Save
            </v-btn>
          </div>
        </div>
      </div>

      <!-- Feature Settings Section -->
      <div class="mt-6 space-y-4">
        <h3 class="text-xl font-semibold">Features</h3>
        <div class="rounded-lg bg-gray-800 p-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1">
              <h4 class="font-medium">Blur Scores</h4>
              <p class="mt-1 text-sm text-gray-400">
                Hide other members' scores until you submit your own
              </p>
            </div>
            <v-switch
              :model-value="blurScoresEnabled"
              color="primary"
              class="ml-5 flex-shrink-0"
              @update:model-value="updateBlurScoresFeature"
            />
          </div>
          <div class="mt-3 flex items-center justify-between gap-4">
            <div class="flex-1">
              <h4 class="font-medium">Awards</h4>
              <p class="mt-1 text-sm text-gray-400">
                Enable the awards feature for this club
              </p>
              <p class="mt-1 text-sm text-yellow-500">
                This feature is experimental and may change in the future.
              </p>
            </div>
            <v-switch
              :model-value="awardsEnabled"
              color="primary"
              class="ml-5 flex-shrink-0"
              @update:model-value="updateAwardsFeature"
            />
          </div>
        </div>
      </div>

      <!-- Club URL Section -->
      <div class="mt-8 space-y-4">
        <h3 class="text-xl font-semibold">Club URL</h3>
        <div class="rounded-lg bg-gray-800 p-4">
          <div class="space-y-3">
            <div class="flex-1">
              <h4 class="font-medium">Custom URL</h4>
              <p class="mt-2 flex items-center gap-1 text-xs text-gray-400">
                <mdicon
                  name="alert-outline"
                  class="text-yellow-400"
                  size="14"
                />
                <span
                  >Warning: Changing the URL will break existing links to your
                  club</span
                >
              </p>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row">
              <span class="text-sm text-gray-400 sm:pt-3">{{ urlPrefix }}</span>
              <div class="flex flex-1 flex-col gap-2">
                <div class="flex gap-2">
                  <input
                    v-model="newSlug"
                    placeholder="your-club-name"
                    class="flex-1 rounded border p-3 text-sm outline-none"
                    :class="
                      slugError
                        ? 'border-red-500 bg-gray-700'
                        : 'border-gray-600 bg-gray-700'
                    "
                    @input="slugError = ''"
                  />
                  <v-btn
                    :disabled="!canSaveSlug"
                    :loading="isUpdatingSlug"
                    class="bg-blue-600 enabled:hover:bg-blue-700"
                    @click="saveSlug"
                  >
                    Save
                  </v-btn>
                </div>
                <p v-if="slugError" class="text-xs text-red-400">
                  {{ slugError }}
                </p>
              </div>
            </div>

            <p class="text-xs text-gray-400">
              3-50 characters, lowercase letters, numbers, and hyphens only.
              Cannot be all numbers.
            </p>
          </div>
        </div>
      </div>

      <!-- Members Section -->
      <div class="mt-8 space-y-4">
        <h3 class="text-xl font-semibold">Members</h3>
        <loading-spinner v-if="isLoadingMembers" />
        <div v-else class="space-y-3">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center justify-between rounded-lg bg-gray-800 p-4"
          >
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <img
                v-if="member.image"
                :src="member.image"
                :alt="member.name"
                class="h-10 w-10 rounded-full object-cover"
              />
              <div class="min-w-0 flex-1">
                <div class="truncate font-medium text-white">
                  {{ member.name }}
                </div>
                <div class="truncate text-sm text-gray-400">
                  {{ member.email }}
                </div>
                <div class="text-xs capitalize text-gray-500">
                  {{ member.role }}
                </div>
              </div>
            </div>
            <v-btn
              v-if="member.email !== currentUserEmail"
              class="h-10 w-10 bg-red-500 hover:bg-red-600"
              variant="danger"
              size="small"
              @click="removeMember(member)"
            >
              <mdicon name="minus" />
            </v-btn>
          </div>
        </div>

        <!-- Invite Link Section -->
        <div class="mt-8 rounded-lg bg-gray-800 p-4">
          <h4 class="mb-4 text-lg font-semibold">Invite Link</h4>
          <div class="space-y-3">
            <div class="flex gap-2">
              <input
                ref="inviteLinkInput"
                :value="inviteLink"
                readonly
                class="flex-1 rounded border border-gray-600 bg-gray-700 p-3 text-sm text-gray-200"
              />
              <v-btn
                class="h-12 w-12 bg-blue-600 hover:bg-blue-700"
                @click="copyInviteLink"
              >
                <mdicon :name="copyIcon" />
              </v-btn>
            </div>
            <p class="text-sm text-gray-400">
              Share this link to invite people to your club
            </p>
          </div>
        </div>
      </div>

      <!-- Leave Club Section -->
      <div class="mt-8 flex justify-center border-t border-gray-700 pt-6">
        <v-btn
          variant="danger"
          class="flex items-center justify-center bg-red-500 py-3 hover:bg-red-600"
          @click="showLeaveConfirm = true"
        >
          Leave Club
        </v-btn>
      </div>
    </div>

    <!-- Leave Club Confirmation Modal -->
    <div
      v-if="showLeaveConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      @click="showLeaveConfirm = false"
    >
      <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6" @click.stop="">
        <h3 class="mb-4 text-xl font-semibold">Leave Club?</h3>
        <p class="mb-6 text-gray-300">
          Are you sure you want to leave this club? This action cannot be
          undone.
        </p>
        <div class="flex gap-3">
          <v-btn
            class="flex-1 bg-gray-600 hover:bg-gray-700"
            @click="showLeaveConfirm = false"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="danger"
            class="flex-1 bg-red-500 hover:bg-red-600"
            :loading="isLeaving"
            @click="leaveClub"
          >
            Leave
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Remove Member Confirmation Modal -->
    <div
      v-if="showRemoveConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      @click="showRemoveConfirm = false"
    >
      <div class="w-full max-w-sm rounded-lg bg-gray-800 p-6" @click.stop="">
        <h3 class="mb-4 text-xl font-semibold">
          Remove {{ memberToRemove?.name }}?
        </h3>
        <p class="mb-6 text-gray-300">
          Are you sure you want to remove this member from the club?
        </p>
        <div class="flex gap-3">
          <v-btn
            class="flex-1 bg-gray-600 hover:bg-gray-700"
            @click="showRemoveConfirm = false"
          >
            Cancel
          </v-btn>
          <v-btn
            variant="danger"
            class="flex-1 bg-red-500 hover:bg-red-600"
            :loading="isRemoving"
            @click="confirmRemoveMember"
          >
            Remove
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AxiosError } from "axios";
import { ref, computed, watch } from "vue";
import { useToast } from "vue-toastification";

import { hasValue } from "../../../../lib/checks/checks";

import {
  useMembers,
  useClubSlug,
  useLeaveClub,
  useRemoveMember,
  useInviteToken,
  useClubSettings,
  useUpdateClubSettings,
  useClub,
  useUpdateClubSlug,
  useUpdateClubName,
} from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const toast = useToast();
const auth = useAuthStore();
const showLeaveConfirm = ref(false);
const showRemoveConfirm = ref(false);
const clubId = useClubSlug();
const inviteLinkInput = ref<HTMLInputElement | null>(null);
const hasCopied = ref(false);
const memberToRemove = ref<{ id: string; name: string } | null>(null);
const isRemoving = ref(false);
const newSlug = ref("");
const slugError = ref("");

const currentUserEmail = computed(() => auth.user?.email);
const { data: club } = useClub(clubId);
const {
  data: members,
  isLoading: isLoadingMembers,
  refetch: refetchMembers,
} = useMembers(clubId);
const { mutate: leaveClubMutation, isPending: isLeaving } =
  useLeaveClub(clubId);
const { mutate: removeMemberMutation } = useRemoveMember(clubId);
const { data: inviteToken } = useInviteToken(clubId);
const { data: settings } = useClubSettings(clubId);
const { mutate: updateSettings } = useUpdateClubSettings(clubId);
const { mutate: updateClubName, isPending: isSavingName } =
  useUpdateClubName(clubId);

const editedClubName = ref(club.value?.clubName ?? "");

const hasNameChanged = computed(() => {
  return (
    hasValue(editedClubName.value) &&
    editedClubName.value !== club.value?.clubName
  );
});

const { mutate: updateSlugMutation, isPending: isUpdatingSlug } =
  useUpdateClubSlug(clubId);
const blurScoresEnabled = computed(
  () => settings.value?.features?.blurScores === true,
);
const awardsEnabled = computed(() => settings.value?.features?.awards === true);

const saveClubName = () => {
  if (!hasNameChanged.value) return;

  updateClubName(editedClubName.value.trim(), {
    onSuccess: () => {
      toast.success("Club name updated successfully");
    },
    onError: () => {
      toast.error("Failed to update club name");
    },
  });
};

// URL management
const currentSlug = computed(() => club.value?.slug ?? "");

// Initialize newSlug with current slug when club data loads
watch(
  currentSlug,
  (slug) => {
    if (slug && !newSlug.value) {
      newSlug.value = slug;
    }
  },
  { immediate: true },
);

const urlPrefix = computed(() => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/club/`;
});

const validateSlugFormat = (slug: string): string | null => {
  if (slug.length < 3 || slug.length > 50) {
    return "URL must be 3-50 characters";
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "Only lowercase letters, numbers, and hyphens allowed";
  }
  if (/^[0-9]+$/.test(slug)) {
    return "URL cannot be all numbers";
  }
  return null;
};

const canSaveSlug = computed(() => {
  if (!newSlug.value || isUpdatingSlug.value) return false;
  if (newSlug.value === currentSlug.value) return false;
  return validateSlugFormat(newSlug.value) === null;
});

const saveSlug = () => {
  slugError.value = "";

  const validationError = validateSlugFormat(newSlug.value);
  if (validationError !== null) {
    slugError.value = validationError;
    return;
  }

  updateSlugMutation(newSlug.value, {
    onSuccess: () => {
      toast.success("Club URL updated successfully");
      slugError.value = "";
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ error?: string }>;
      const errorMessage =
        axiosError.response?.data?.error ?? "Failed to update URL";
      slugError.value = errorMessage;
      toast.error(errorMessage);
    },
  });
};

const updateAwardsFeature = (value: boolean) => {
  updateSettings(
    { features: { awards: value } },
    {
      onSuccess: () => toast.success("Settings updated successfully"),
      onError: () => toast.error("Failed to update settings"),
    },
  );
};

const updateBlurScoresFeature = (value: boolean) => {
  updateSettings(
    { features: { blurScores: value } },
    {
      onSuccess: () => toast.success("Settings updated successfully"),
      onError: () => toast.error("Failed to update settings"),
    },
  );
};

const inviteLink = computed(() => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join-club/${inviteToken.value}`;
});

const copyIcon = computed(() => (hasCopied.value ? "check" : "content-copy"));

const copyInviteLink = async () => {
  try {
    await navigator.clipboard.writeText(inviteLink.value);
    hasCopied.value = true;
    setTimeout(() => {
      hasCopied.value = false;
    }, 2000);
  } catch {
    // Fallback for browsers that don't support clipboard API
    if (inviteLinkInput.value) {
      inviteLinkInput.value.select();
      document.execCommand("copy");
    }
  }
};

const leaveClub = () => {
  leaveClubMutation();
};

const removeMember = (member: { id: string; name: string }) => {
  memberToRemove.value = member;
  showRemoveConfirm.value = true;
};

const confirmRemoveMember = () => {
  if (!memberToRemove.value) return;

  isRemoving.value = true;
  removeMemberMutation(memberToRemove.value.id, {
    onSuccess: () => {
      toast.success("Member removed successfully");
      refetchMembers().catch(console.error);
      showRemoveConfirm.value = false;
      isRemoving.value = false;
    },
    onError: () => {
      toast.error("Failed to remove member");
      isRemoving.value = false;
    },
  });
};
</script>
