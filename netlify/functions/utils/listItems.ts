import { hasValue } from "../../../lib/checks/checks.js";
import {
  type DetailedWorkListItem,
  type UserListItemWithSource,
  type WorkDataSummary,
} from "../../../lib/types/lists.js";
import { getExternalSummariesForWorks } from "./providers";

interface ListItemRow {
  id: string;
  title: string;
  type: DetailedWorkListItem["type"];
  time_added: Date;
  image_url: string | null;
  external_id: string | null;
  added_by_user_id: string | null;
}

/** Map a joined work + list-item row to the API list-item shape, attaching
 * its external metadata summary. */
export function toDetailedListItem(
  item: ListItemRow,
  externalData: Map<string, WorkDataSummary>,
): DetailedWorkListItem {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    createdDate: item.time_added.toISOString(),
    imageUrl: item.image_url ?? undefined,
    externalId: item.external_id ?? undefined,
    addedBy: item.added_by_user_id ?? undefined,
    externalData: hasValue(item.external_id) ? externalData.get(item.external_id) : undefined,
  };
}

/** Items from the club's user lists, each with its metadata summary and the list it is on. */
export async function toUserListItemsWithSource(
  items: (ListItemRow & { list_id: string; list_title: string })[],
): Promise<UserListItemWithSource[]> {
  const externalData = await getExternalSummariesForWorks(
    items.map((item) => ({ externalId: item.external_id, type: item.type })),
  );
  return items.map((item) => ({
    ...toDetailedListItem(item, externalData),
    sourceListId: item.list_id,
    sourceListTitle: item.list_title,
  }));
}
