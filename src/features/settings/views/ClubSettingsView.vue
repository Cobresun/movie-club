<template>
  <div>
    <page-header page-name="Club Settings" has-back back-route="ClubHome" />

    <div class="mx-auto max-w-3xl p-4">
      <div class="mt-8 space-y-4">
        <h3 class="text-2xl font-semibold">Members</h3>
        <loading-spinner v-if="isLoadingMembers" />
        <div v-else class="rounded-lg shadow-sm">
          <div
            v-for="member in members"
            :key="member.id"
            class="mb-3 flex items-center justify-between rounded-md p-2 hover:bg-gray-700"
          >
            <div class="flex items-center gap-3">
              <img
                v-if="member.image"
                :src="member.image"
                :alt="member.name"
                class="h-10 w-10 rounded-full object-cover"
              />
              <div class="flex gap-4">
                <span class="text-md">{{ member.name }}</span>
                <span class="text-md text-gray-500">{{ member.email }}</span>
                <span class="text-md text-gray-500">({{ member.role }})</span>
              </div>
            </div>
            <v-btn
              v-if="member.email !== currentUserEmail"
              class="h-[44px] min-w-[44px] bg-red-500 text-white hover:bg-red-700"
              variant="danger"
              @click="removeMember(member)"
            >
              <mdicon name="minus" />
            </v-btn>
          </div>
        </div>

        <div class="rounded-lg p-6">
          <h4 class="mb-3 text-2xl font-semibold">Invite Link</h4>
          <div class="flex items-center gap-3">
            <input
              ref="inviteLinkInput"
              :value="inviteLink"
              readonly
              class="w-full rounded-md bg-gray-50 p-3 text-sm text-gray-600"
            />
            <v-btn class="h-[44px] min-w-[44px]" @click="copyInviteLink">
              <mdicon :name="copyIcon" />
            </v-btn>
          </div>
          <p class="mt-2 text-sm text-gray-500">
            Share this link to invite people to your club
          </p>
        </div>
      </div>
      <div class="my-6 mt-20 border-t">
        <v-btn
          variant="danger"
          class="mt-8 rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          @click="showLeaveConfirm = true"
        >
          Leave Club
        </v-btn>
      </div>
    </div>

    <div
      v-if="showLeaveConfirm"
      class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
      @click="showLeaveConfirm = false"
    >
      <div class="rounded-lg bg-background p-8" @click.stop="">
        <div class="rounded-lg p-6">
          <h3 class="mb-4 text-2xl font-semibold">Leave Club?</h3>
          <p class="mb-6 leading-relaxed text-gray-500">
            Are you sure you want to leave this club? This action cannot be
            undone.
          </p>
          <div class="items-center space-x-4">
            <v-btn
              class="bg-gray-100 px-6 py-2 text-gray-700 hover:bg-gray-200"
              @click="showLeaveConfirm = false"
            >
              Cancel
            </v-btn>
            <v-btn
              variant="danger"
              class="bg-red-500 px-6 py-2 text-white hover:bg-red-700"
              :loading="isLeaving"
              @click="leaveClub"
            >
              Leave Club
            </v-btn>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showRemoveConfirm"
      class="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50"
      @click="showRemoveConfirm = false"
    >
      <div class="rounded-lg bg-background p-8" @click.stop="">
        <div class="rounded-lg p-6">
          <h3 class="mb-4 text-2xl font-semibold">
            Remove {{ memberToRemove?.name }}?
          </h3>
          <p class="mb-6 leading-relaxed text-gray-500">
            Are you sure you want to remove this member from the club?
          </p>
          <div class="items-center space-x-4">
            <v-btn
              class="bg-gray-100 px-6 py-2 text-gray-700 hover:bg-gray-200"
              @click="showRemoveConfirm = false"
            >
              Cancel
            </v-btn>
            <v-btn
              variant="danger"
              class="bg-red-500 px-6 py-2 text-white hover:bg-red-600"
              :loading="isRemoving"
              @click="confirmRemoveMember"
            >
              Remove
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useToast } from "vue-toastification";

import {
  useMembers,
  useClubId,
  useLeaveClub,
  useRemoveMember,
  useInviteToken,
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
