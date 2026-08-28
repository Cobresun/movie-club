export type ZIndex = "40" | "50" | "60";

const CLASS_BY_ZINDEX: Record<ZIndex, string> = {
  "40": "z-40",
  "50": "z-50",
  "60": "z-[60]",
};

export const zIndexClass = (zIndex: ZIndex): string => CLASS_BY_ZINDEX[zIndex];

// Backdrop sits one stacking level below its content.
const LOWER_ZINDEX: Record<ZIndex, ZIndex> = {
  "40": "40",
  "50": "40",
  "60": "50",
};

export const lowerZIndex = (zIndex: ZIndex): ZIndex => LOWER_ZINDEX[zIndex];
