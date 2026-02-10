import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { computed, h, Ref } from "vue";

import { Member } from "../../../../lib/types/club";
import { getScoreContextColor } from "../scoring";
import type { MovieData } from "../types";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import MovieTooltip from "@/features/reviews/components/MovieTooltip.vue";

const columnHelper = createColumnHelper<MovieData>();

export function useScoresTable(
  filteredMovieData: Ref<MovieData[]>,
  members: Ref<Member[]>,
  showScoreContext: Ref<boolean>,
) {
  const columns = computed(() => [
    columnHelper.accessor("title", {
      header: "Title",
      cell: (info) =>
        h(MovieTooltip, {
          title: info.getValue(),
          imageUrl: info.row.original.imageUrl,
          movie: info.row.original.externalData,
        }),
      meta: {
        class: "font-bold",
      },
    }),
    columnHelper.accessor("dateWatched", {
      header: "Date Reviewed",
    }),
    ...members.value.map((member) =>
      columnHelper.accessor((row) => row.userScores[member.id], {
        id: member.id,
        header: () =>
          h(VAvatar, {
            src: member.image,
            name: member.name,
          }),
        cell: (info) => {
          const value = info.getValue();
          if (value === undefined) return "";
          const display = Math.round(value * 100) / 100;

          if (!showScoreContext.value) return String(display);

          const zScore = info.row.original.normalized[member.id];
          const bgColor = getScoreContextColor(zScore);
          return h(
            "div",
            {
              class: "rounded-md px-2 py-1 text-center",
              style: { backgroundColor: bgColor },
            },
            String(display),
          );
        },
        sortUndefined: "last",
      }),
    ),
    columnHelper.accessor("average", {
      header: () =>
        h("img", {
          src: AverageImg,
          class: "h-12 w-16 max-w-none",
        }),
      cell: (info) => {
        const value = info.getValue();
        return value !== undefined ? Math.round(value * 100) / 100 : "";
      },
      sortUndefined: "last",
    }),
    columnHelper.accessor((row) => row.externalData.vote_average, {
      id: "vote_average",
      header: "TMDB",
      cell: (info) => {
        const value = info.getValue();
        return value !== undefined ? Math.round(value * 100) / 100 : "";
      },
    }),
  ]);

  const table = useVueTable({
    get columns() {
      return columns.value;
    },
    get data() {
      return filteredMovieData.value ?? [];
    },
    getCoreRowModel: getCoreRowModel<MovieData>(),
    getSortedRowModel: getSortedRowModel<MovieData>(),
    getRowId: (row) => row.id,
  });

  return { table };
}
