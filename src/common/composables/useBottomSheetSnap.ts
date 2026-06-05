import { computed, onUnmounted, ref } from "vue";
import type { Ref } from "vue";

export type Detent = "half" | "full";
export type SnapState = "dismissed" | "half" | "full";

interface SnapTarget {
  state: SnapState;
  top: number;
}

interface UseBottomSheetSnapOptions {
  /** The fixed, full-viewport scroll container. */
  host: Ref<HTMLElement | null>;
  /** Reactive getter for the enabled detents (e.g. ["half", "full"]). */
  detents: () => Detent[];
  /** Reactive getter for the detent to open at. */
  initialDetent: () => Detent;
  /** Called once the sheet has fully collapsed and should be unmounted. */
  onClose: () => void;
  /** Called when the settled detent changes. */
  onSnapChange?: (state: SnapState) => void;
}

const MAX_SCRIM_OPACITY = 0.5;
// Time with no scroll events before we treat the gesture as settled. iOS
// momentum keeps firing scroll events, so this fires once the flick comes to
// rest — a cross-browser substitute for the (patchily supported) `scrollend`.
const SETTLE_DELAY_MS = 120;
// Safety net so a missed settle during the closing animation can never leave
// the parent's v-if stuck open.
const CLOSE_FALLBACK_MS = 400;
const HALF_VIEWPORT_FRACTION = 0.5;
// If full and half would land closer than this, the content is too short to
// justify a distinct half detent — collapse them into a single open state.
const MIN_DETENT_GAP_PX = 48;

/**
 * Drives a bottom sheet using the browser's native scroll-snap mechanics rather
 * than hand-rolled touch tracking. The host is a fixed, full-viewport scroll
 * container; the sheet sits at the bottom of its scrollable content, so
 * `scrollTop` maps directly to how far the sheet is revealed:
 *
 *   scrollTop 0          -> panel below the fold        -> "dismissed"
 *   scrollTop H/2        -> panel half revealed         -> "half"
 *   scrollTop scrollMax  -> panel fully in view         -> "full"
 *
 * Zero-height marker elements with `scroll-snap-align: start` placed at those
 * offsets make the browser snap (with native momentum) to each state. This
 * composable measures the targets, animates open/close, fades the backdrop with
 * the scroll position, and reports the settled detent.
 */
export function useBottomSheetSnap(options: UseBottomSheetSnapOptions) {
  const { host, detents, initialDetent, onClose, onSnapChange } = options;

  // Toggled off during programmatic (open/close) scrolls so mandatory snapping
  // doesn't fight the smooth animation; the template binds it to the host's
  // `scroll-snap-type`.
  const snapEnabled = ref(false);
  const backdropProgress = ref(0); // 0..1, where 1 = fully open
  const currentState = ref<SnapState>("dismissed");

  // Content offsets of the half/full snap markers, bound as `top` in the
  // template. The dismiss marker is always at 0.
  const halfTop = ref(0);
  const fullTop = ref(0);

  let mode: "opening" | "idle" | "closing" = "opening";
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let closeFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const backdropOpacity = computed(
    () => backdropProgress.value * MAX_SCRIM_OPACITY,
  );
  const atFull = computed(() => currentState.value === "full");

  const snapTargets = (): SnapTarget[] => {
    const targets: SnapTarget[] = [{ state: "dismissed", top: 0 }];
    const hasRoomForHalf = fullTop.value - halfTop.value >= MIN_DETENT_GAP_PX;
    if (detents().includes("half") && hasRoomForHalf) {
      targets.push({ state: "half", top: halfTop.value });
    }
    targets.push({ state: "full", top: fullTop.value });
    return targets;
  };

  // Backdrop reaches full scrim at the lowest open detent and stays there above
  // it; below that it fades toward transparent as you drag to dismiss.
  const minOpenTop = (): number => {
    const open = snapTargets().filter((t) => t.state !== "dismissed");
    const tops = open.map((t) => t.top);
    return tops.length > 0 ? Math.max(1, Math.min(...tops)) : 1;
  };

  const measure = () => {
    const hostEl = host.value;
    if (!hostEl) return;
    const viewport = hostEl.clientHeight;
    fullTop.value = Math.max(0, hostEl.scrollHeight - viewport);
    halfTop.value = Math.min(
      Math.round(viewport * HALF_VIEWPORT_FRACTION),
      fullTop.value,
    );
  };

  const targetTopFor = (state: SnapState): number => {
    const match = snapTargets().find((t) => t.state === state);
    return match ? match.top : fullTop.value;
  };

  const nearestTarget = (scrollTop: number): SnapTarget =>
    snapTargets().reduce((closest, t) =>
      Math.abs(t.top - scrollTop) < Math.abs(closest.top - scrollTop)
        ? t
        : closest,
    );

  const updateBackdrop = () => {
    const hostEl = host.value;
    if (!hostEl) return;
    backdropProgress.value = Math.min(
      1,
      Math.max(0, hostEl.scrollTop / minOpenTop()),
    );
  };

  const finishClose = () => {
    if (closed) return;
    closed = true;
    cleanup();
    onClose();
  };

  const setState = (state: SnapState) => {
    if (state === currentState.value) return;
    currentState.value = state;
    onSnapChange?.(state);
  };

  const handleSettle = () => {
    const hostEl = host.value;
    if (!hostEl) return;

    if (mode === "opening") {
      mode = "idle";
      snapEnabled.value = true;
      setState(nearestTarget(hostEl.scrollTop).state);
      return;
    }
    if (mode === "closing") return; // resolved by scrollTo + fallback timer

    const target = nearestTarget(hostEl.scrollTop);
    if (target.state === "dismissed") {
      finishClose();
    } else {
      setState(target.state);
    }
  };

  const onScroll = () => {
    updateBackdrop();

    // Crisp finish: collapse animation reached the top.
    if (mode === "closing" && (host.value?.scrollTop ?? 0) <= 2) {
      finishClose();
      return;
    }

    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(handleSettle, SETTLE_DELAY_MS);
  };

  // `scrollTo` is the only browser API the engine depends on; jsdom (tests) and
  // any environment without it fall back to an instant jump so the component is
  // inert-but-safe rather than throwing.
  const scrollHostTo = (top: number, behavior: ScrollBehavior) => {
    const hostEl = host.value;
    if (!hostEl) return;
    if (typeof hostEl.scrollTo === "function") {
      hostEl.scrollTo({ top, behavior });
    } else {
      hostEl.scrollTop = top;
    }
  };

  const onResize = () => {
    if (!host.value || mode !== "idle") return;
    const state = currentState.value;
    measure();
    scrollHostTo(targetTopFor(state), "auto");
  };

  function cleanup() {
    host.value?.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    if (settleTimer) clearTimeout(settleTimer);
    if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
  }

  /** Mount the sheet off-screen, then animate up to the initial detent. */
  const open = () => {
    const hostEl = host.value;
    if (!hostEl) return;

    measure();
    mode = "opening";
    snapEnabled.value = false;
    closed = false;
    backdropProgress.value = 0;
    hostEl.scrollTop = 0;

    hostEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    requestAnimationFrame(() => {
      scrollHostTo(targetTopFor(initialDetent()), "smooth");
    });
  };

  /** Animate the sheet down and unmount once collapsed. */
  const requestClose = () => {
    if (!host.value || closed) return;
    mode = "closing";
    snapEnabled.value = false;
    scrollHostTo(0, "smooth");
    closeFallbackTimer = setTimeout(finishClose, CLOSE_FALLBACK_MS);
  };

  onUnmounted(cleanup);

  return {
    /** Bind to the host's `scroll-snap-type`. */
    snapEnabled,
    /** 0..0.5 — bind to <v-backdrop :opacity>. */
    backdropOpacity,
    /** The currently settled detent. */
    currentState,
    /** True only while resting at the full detent (drives expand-to-scroll). */
    atFull,
    halfTop,
    fullTop,
    open,
    requestClose,
  };
}
