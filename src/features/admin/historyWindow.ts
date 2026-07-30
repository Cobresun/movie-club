/**
 * The snapshot-history windows the dashboard offers.
 *
 * A plain module rather than exports from SnapshotHistoryWidget.vue: a
 * `<script setup>` block cannot contain ES module exports at all, so a
 * component that both renders the toggle and defines its options has to keep
 * the options somewhere else.
 *
 * Values are strings because SegmentedToggle is generic over `string`. The API
 * clamps whatever it receives to 1–365, so these are a convenience, not a
 * contract.
 */
export const HISTORY_WINDOW_OPTIONS = [
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "365", label: "1y" },
] as const;

export type HistoryWindow = (typeof HISTORY_WINDOW_OPTIONS)[number]["value"];
