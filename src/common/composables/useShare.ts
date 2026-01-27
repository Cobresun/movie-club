import { useToast } from "vue-toastification";

interface ShareOptions {
  url: string;
  title: string;
  text?: string;
}

/**
 * Composable for sharing content using the native Web Share API when available,
 * with fallback to clipboard copy.
 */
export function useShare() {
  const toast = useToast();

  const canUseNativeShare = () => {
    return typeof navigator !== "undefined" && "share" in navigator;
  };

  const share = async ({ url, title, text }: ShareOptions): Promise<void> => {
    if (canUseNativeShare()) {
      try {
        await navigator.share({
          url,
          title,
          text,
        });
        // User completed or cancelled share - no toast needed for native share
      } catch (error) {
        // User cancelled the share or an error occurred
        if (error instanceof Error && error.name !== "AbortError") {
          // Only fallback to clipboard if it's not a user cancellation
          await copyToClipboard(url);
        }
      }
    } else {
      await copyToClipboard(url);
    }
  };

  const copyToClipboard = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share URL copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy share URL");
    }
  };

  return {
    share,
    canUseNativeShare,
  };
}
