<template>
  <div>
    <page-header page-name="Club Settings" has-back back-route="ClubHome" />

    <div class="mx-auto max-w-3xl px-4 pb-6">
      <!-- Feature Settings Section -->
      <div class="mt-6 space-y-4">
        <h3 class="text-xl font-semibold">Features</h3>
        <div class="rounded-lg bg-gray-800 p-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex-1 text-left">
              <h4 class="text-left font-medium">Blur Scores</h4>
              <p class="mt-1 text-left text-sm text-gray-400">
                Hide other members' scores until you submit your own
              </p>
            </div>
            <v-switch
              v-model="blurScoresEnabled"
              color="primary"
              class="ml-5 flex-shrink-0"
              @update:model-value="updateBlurScoresFeature"
            />
          </div>
          <div class="mt-3 flex items-center justify-between gap-4">
            <div class="flex-1 text-left">
              <h4 class="text-left font-medium">Awards</h4>
              <p class="mt-1 text-left text-sm text-gray-400">
                Enable the awards feature for this club
              </p>
            </div>
            <v-switch
              v-model="awardsEnabled"
              color="primary"
              class="ml-5 flex-shrink-0"
              @update:model-value="updateAwardsFeature"
            />
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
              <div class="min-w-0 flex-1 text-left">
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
import { ref, computed, watch } from "vue";
import { useToast } from "vue-toastification";

import {
  useMembers,
  useClubId,
  useLeaveClub,
  useRemoveMember,
  useInviteToken,
  useClubSettings,
  useUpdateClubSettings,
} from "@/service/useClub";
import { useAuthStore } from "@/stores/auth";

const toast = useToast();
const auth = useAuthStore();
const showLeaveConfirm = ref(false);
const showRemoveConfirm = ref(false);
const clubId = useClubId();
const inviteLinkInput = ref<HTMLInputElement | null>(null);
const hasCopied = ref(false);
const memberToRemove = ref<{ id: string; name: string } | null>(null);
const isRemoving = ref(false);

const currentUserEmail = computed(() => auth.user?.email);
const {
  data: members,
  isLoading: isLoadingMembers,
  refetch: refetchMembers,
} = useMembers(clubId);
const { mutate: leaveClubMutation, isLoading: isLeaving } =
  useLeaveClub(clubId);
const { mutate: removeMemberMutation } = useRemoveMember(clubId);
const { data: inviteToken } = useInviteToken(clubId);
const { data: settings, isLoading: isLoadingSettings } =
  useClubSettings(clubId);
const { mutate: updateSettings } = useUpdateClubSettings(clubId);
const blurScoresEnabled = ref(true);
const awardsEnabled = ref(false);

watch(
  () => settings.value,
  (newSettings) => {
    if (newSettings && !isLoadingSettings.value) {
      blurScoresEnabled.value = newSettings?.features?.blurScores === true;
      awardsEnabled.value = newSettings?.features?.awards === true;
    }
  },
  { immediate: true },
);

const updateAwardsFeature = () => {
  updateSettings(
    {
      features: {
        awards: awardsEnabled.value,
      },
    },
    {
      onSuccess: () => {
        toast.success("Settings updated successfully");
      },
      onError: () => {
        toast.error("Failed to update settings");
        if (settings.value?.features?.awards !== undefined) {
          awardsEnabled.value = settings.value.features.awards === true;
        }
      },
    },
  );
};

const updateBlurScoresFeature = () => {
  updateSettings(
    {
      features: {
        blurScores: blurScoresEnabled.value,
      },
    },
    {
      onSuccess: () => {
        toast.success("Settings updated successfully");
      },
      onError: () => {
        toast.error("Failed to update settings");
        // Revert the switch if the update failed
        if (settings.value?.features?.blurScores !== undefined) {
          blurScoresEnabled.value = settings.value.features.blurScores === true;
        }
      },
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
