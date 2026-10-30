import { ref, computed } from "vue";

import { useInviteToken } from "@/service/useClub";

export function useCopyInviteLink(clubSlug: string) {
  const { data: inviteToken } = useInviteToken(clubSlug);

  const inviteLinkInput = ref<HTMLInputElement | null>(null);
  const hasCopied = ref(false);

  const inviteLink = computed(() => `${window.location.origin}/join-club/${inviteToken.value}`);
  const copyIcon = computed(() => (hasCopied.value ? "check" : "content-copy"));
  const copyLabel = computed(() => (hasCopied.value ? "Invite link copied" : "Copy invite link"));

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink.value);
    } catch {
      if (inviteLinkInput.value) {
        inviteLinkInput.value.select();
        // oxlint-disable-next-line typescript/no-deprecated -- legacy clipboard fallback when navigator.clipboard is unavailable
        document.execCommand("copy");
      }
    }
    hasCopied.value = true;
    setTimeout(() => {
      hasCopied.value = false;
    }, 2000);
  };

  return { inviteLinkInput, inviteLink, copyIcon, copyLabel, copyInviteLink };
}
