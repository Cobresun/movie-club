import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
  type Table,
} from "@tanstack/vue-table";
import { DateTime } from "luxon";
import { defineComponent, h, type Component } from "vue";

import type { Member } from "../../../../lib/types/club";
import { WorkType } from "../../../../lib/types/generated/db";
import type { DetailedReviewListItem } from "../../../../lib/types/lists";

const columnHelper = createColumnHelper<DetailedReviewListItem>();

export function makeReview(
  overrides: Partial<DetailedReviewListItem> = {},
): DetailedReviewListItem {
  return {
    id: "1",
    title: "Dune",
    type: WorkType.movie,
    createdDate: "2024-05-28T04:46:37.751Z",
    imageUrl: "https://image.tmdb.org/dune.jpg",
    externalId: "438631",
    scores: {},
    ...overrides,
  };
}

export function makeReviewMember(overrides: Partial<Member> = {}): Member {
  return { id: "m1", email: "ada@test.com", name: "Ada Lovelace", ...overrides };
}

/** One member's score for a review, in the shape the reviews payload uses. */
export function score(id: string, value: number) {
  return { id, created_date: "2024-05-28T04:46:37.751Z", score: value };
}

/**
 * The columns ReviewView builds, reduced to the parts GalleryView and TableView
 * actually read: the poster/title/date trio they render themselves, one column
 * per member, and the club average. Cells render plain text rather than the
 * real `ReviewScore`/`MovieTooltip` components so these specs stay about the two
 * layout components rather than their children.
 */
function testColumns(members: Member[]) {
  return [
    columnHelper.accessor("imageUrl", { header: "Poster" }),
    columnHelper.accessor("title", { header: "Title" }),
    columnHelper.accessor("createdDate", {
      header: "Date Reviewed",
      cell: (info) => DateTime.fromISO(info.getValue()).toLocaleString(),
    }),
    ...members.map((member) =>
      columnHelper.accessor((row) => row.scores[member.id]?.score, {
        id: `member_${member.id}`,
        header: () => h("span", member.name),
        cell: (info) => info.getValue() ?? "",
        sortUndefined: "last" as const,
      }),
    ),
    columnHelper.accessor((row) => row.scores.average?.score, {
      id: "score_average",
      header: () => h("span", "Average"),
      cell: (info) => info.getValue() ?? "",
      sortUndefined: "last" as const,
    }),
  ];
}

/**
 * Wrap a component that takes a `reviewTable` prop in a host that builds a real
 * TanStack table over `reviews`. `useVueTable` needs a component instance, so
 * the table cannot simply be constructed in a spec's module scope.
 *
 * Extra props for the component under test go in `props`; the host exposes the
 * table itself as `tableRef` so a spec can assert on sorting state.
 */
export function withReviewTable(
  component: Component,
  {
    reviews,
    members = [],
    props = {},
  }: {
    reviews: DetailedReviewListItem[];
    members?: Member[];
    props?: Record<string, unknown>;
  },
) {
  let table: Table<DetailedReviewListItem> | undefined;

  const host = defineComponent({
    name: "ReviewTableHost",
    setup(_props, { emit }) {
      table = useVueTable({
        columns: testColumns(members),
        data: reviews,
        getCoreRowModel: getCoreRowModel<DetailedReviewListItem>(),
        getSortedRowModel: getSortedRowModel<DetailedReviewListItem>(),
        getRowId: (row) => row.id,
      });

      return () =>
        h(component, {
          reviewTable: table,
          ...props,
          onToggleReveal: (id: string) => emit("toggle-reveal", id),
        });
    },
    emits: ["toggle-reveal"],
  });

  return { host, getTable: () => table };
}
