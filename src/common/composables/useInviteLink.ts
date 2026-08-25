import { computed, ref } from "vue";

import { isDefined } from "@/../lib/checks/checks";
import { useInviteToken } from "@/service/useClub";

/** How long the copy button stays on its confirmation icon. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * The club's shareable invite URL plus the copy-to-clipboard interaction every
 * surface that offers the link renders the same way.
 *
 * Bind `inviteLinkInput` to the readonly input showing the link: browsers
 * without the async Clipboard API fall back to selecting that element and
 * running `document.execCommand("copy")`, which needs a real DOM node.
 */
export function useInviteLink(clubSlug: string) {
  const { data: inviteToken } = useInviteToken(clubSlug);

  const inviteLinkInput = ref<HTMLInputElement | null>(null);
  const hasCopied = ref(false);

  const inviteLink = computed(() => `${window.location.origin}/join-club/${inviteToken.value}`);

  const copyIcon = computed(() => (hasCopied.value ? "check" : "content-copy"));

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink.value);
      hasCopied.value = true;
      setTimeout(() => {
        hasCopied.value = false;
      }, COPIED_FEEDBACK_MS);
    } catch {
      if (isDefined(inviteLinkInput.value)) {
        inviteLinkInput.value.select();
        document.execCommand("copy");
      }
    }
  };

  return { inviteToken, inviteLink, inviteLinkInput, hasCopied, copyIcon, copyInviteLink };
}
