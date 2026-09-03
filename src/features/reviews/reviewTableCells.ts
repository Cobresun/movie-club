import { Row } from "@tanstack/vue-table";

import { DetailedReviewListItem } from "../../../lib/types/lists";

const CUSTOM_RENDERED_COLUMNS = ["title", "imageUrl", "createdDate"];

/**
 * Visible, non-empty cells for a review row: custom-rendered columns (title,
 * image, date) are handled outside the generated grid, and an unscored
 * member's cell is hidden rather than shown empty.
 */
export const getVisibleCells = (row: Row<DetailedReviewListItem>) => {
  return row.getVisibleCells().filter((cell) => {
    if (CUSTOM_RENDERED_COLUMNS.includes(cell.column.id)) {
      return false;
    }

    const value = cell.getValue();
    return value !== undefined && value !== null && value !== "";
  });
};
