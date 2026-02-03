import { useToast } from "vue-toastification";

interface ShareOptions {
  url: string;
  title: string;
  text?: string;
}

/**
 * Detects if the current device is a mobile device.
 * Checks user agent for mobile device indicators.
 */
const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  // Check for mobile device indicators in user agent
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  return mobileRegex.test(ua);
};

/**
 * Composable for sharing content using the native Web Share API when available,
 * with fallback to clipboard copy.
 */
export function useShare() {
  const toast = useToast();

  const canUseNativeShare = () => {
    if (typeof navigator === "undefined") return false;

    // Only use native share on mobile devices
    if (!isMobileDevice()) {
      return false;
    }

    return "share" in navigator;
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
