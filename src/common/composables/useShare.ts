import { useToast } from "vue-toastification";

interface ShareOptions {
  url: string;
  title: string;
  text?: string;
}

interface ShareImageOptions {
  blob: Blob;
  fileName: string;
  title: string;
}

/**
 * Detects if the current device is a mobile device.
 * Checks user agent for mobile device indicators.
 */
const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;

  // Check for mobile device indicators in user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

  return mobileRegex.test(ua);
};

/**
 * Detects iOS devices (iPhone/iPad/iPod), including iPadOS reporting a
 * Mac user agent.
 */
const isIosDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;

  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") &&
      typeof document !== "undefined" &&
      "ontouchend" in document)
  );
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
          // WebKit quirk: when both `text` and `url` are passed on iOS, the
          // share sheet's "Copy" action copies only the text and drops the
          // URL, so omit the text there to keep the link copyable.
          text: isIosDevice() ? undefined : text,
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

  /**
   * Hands an image to the share sheet on mobile, so it can go straight to a
   * story or a chat, and downloads it everywhere else.
   */
  const shareImage = async ({ blob, fileName, title }: ShareImageOptions): Promise<void> => {
    const file = new File([blob], fileName, { type: blob.type });
    if (canUseNativeShare() && "canShare" in navigator && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    downloadFile(file);
  };

  const downloadFile = (file: File): void => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    // Revoking in the same task can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success("Image saved to your downloads");
  };

  return {
    share,
    shareImage,
    canUseNativeShare,
  };
}
