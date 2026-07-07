import { ref } from "vue";

/**
 * Position a `position: fixed` panel just below an anchor element, flipping
 * above / clamping to the viewport when it would overflow. Pairs with a
 * `<Teleport to="body">` panel so it escapes ancestor `overflow` and stacking
 * contexts — needed inside the reviews table, whose `overflow-x-auto` wrapper
 * and sticky cells would otherwise clip an absolutely-positioned popover.
 */
export function useAnchoredPanel(
  options: {
    width?: number;
    estimatedHeight?: number;
    gap?: number;
    margin?: number;
  } = {},
) {
  const { width = 220, estimatedHeight = 240, gap = 8, margin = 16 } = options;

  const style = ref({ top: "0px", left: "0px", zIndex: "9999" });

  const reposition = (anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + gap;

    if (left + width > window.innerWidth) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) {
      left = margin;
    }
    if (top + estimatedHeight > window.innerHeight) {
      top = rect.top - estimatedHeight - gap;
    }

    style.value = { top: `${top}px`, left: `${left}px`, zIndex: "9999" };
  };

  return { style, reposition };
}
