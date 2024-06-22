<template>
  <div class="p-2">
    <add-review-prompt v-if="modalOpen" @close="closePrompt" />
    <page-header :has-back="true" back-route="ClubHome" page-name="Reviews">
      <div class="flex gap-2">
        <mdicon name="table" />
        <VToggle v-model="isGalleryView" />
        <mdicon name="image-multiple" />
      </div>
    </page-header>
    <loading-spinner v-if="loading" />
    <div v-else>
      <div
        class="flex items-center justify-center"
        :class="isGalleryView ? 'mb-4' : 'mb-0'"
      >
        <div class="relative">
          <mdicon
            name="magnify"
            class="absolute left-8 top-1/2 -translate-y-1/2 transform text-slate-200"
          />
          <input
            ref="searchInput"
            v-model="searchTerm"
            class="w-11/12 rounded-md border-2 border-slate-600 bg-background p-2 pl-12 text-base text-white outline-none focus:border-primary"
            placeholder="Search"
            @focusin="searchInputFocusIn"
            @focusout="searchInputFocusOut"
          />
          <div
            ref="searchInputSlash"
            class="absolute right-8 top-1/2 -translate-y-1/2 transform rounded-md border-2 border-slate-600 px-2 py-1"
          >
            <p name="slash" class="text-xs text-slate-200">/</p>
          </div>
        </div>
        <v-btn
          class="ml-2 flex h-11 w-11 items-center justify-center whitespace-nowrap"
          @click="openPrompt()"
        >
          <mdicon name="plus" />
        </v-btn>
      </div>
      <table-view v-if="!isGalleryView" :review-table="reviewTable" />
      <gallery-view
        v-else
        :review-table="reviewTable"
        :delete-review="deleteReview"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  useVueTable,
} from "@tanstack/vue-table";
import { DateTime } from "luxon";
import {
  computed,
  ref,
  onMounted,
  onUnmounted,
  h,
  resolveComponent,
} from "vue";

import { filterMovies } from "../../../common/searchMovies";
import GalleryView from "../components/GalleryView.vue";
import ReviewScore from "../components/ReviewScore.vue";
import TableView from "../components/TableView.vue";

import AverageImg from "@/assets/images/average.svg";
import VAvatar from "@/common/components/VAvatar.vue";
import VToggle from "@/common/components/VToggle.vue";
import { WorkListType } from "@/common/types/generated/db";
import { DetailedReviewListItem } from "@/common/types/lists";
import AddReviewPrompt from "@/features/reviews/components/AddReviewPrompt.vue";
import { useIsInClub, useMembers } from "@/service/useClub";
import { useDeleteListItem, useList } from "@/service/useList";

const { clubId } = defineProps<{ clubId: string }>();

const isGalleryView = ref(false);

const { isLoading: loadingReviews, data: reviews } = useList(
  clubId,
  WorkListType.reviews,
);
const { isLoading: loadingMembers, data: membersResponse } = useMembers(clubId);

const loading = computed(() => loadingReviews.value || loadingMembers.value);

const modalOpen = ref(false);
const openPrompt = () => {
  modalOpen.value = true;
};
const closePrompt = () => {
  modalOpen.value = false;
};

const searchTerm = ref("");
const filteredReviews = computed<DetailedReviewListItem[]>(() => {
  return filterMovies(reviews.value ?? [], searchTerm.value);
});

const searchInput = ref<HTMLInputElement | null>(null);
const searchInputSlash = ref<HTMLParagraphElement | null>(null);

const onKeyPress = (e: KeyboardEvent) => {
  if (e.key == "/") {
    if (searchInput.value === document.activeElement) {
      return;
    }
    e.preventDefault();
    searchInput.value?.focus();
  }
};

onMounted(() => {
  window.addEventListener("keypress", onKeyPress);
});

onUnmounted(() => {
  window.removeEventListener("keypress", onKeyPress);
});

const searchInputFocusIn = () => {
  searchInputSlash.value?.setAttribute("hidden", "true");
};

const searchInputFocusOut = () => {
  searchInputSlash.value?.removeAttribute("hidden");
};

const columnHelper = createColumnHelper<DetailedReviewListItem>();

const members = computed(() => membersResponse.value ?? []);
const isUserInClub = useIsInClub(clubId);

const commonColumnVisibility = computed(() => ({
  edit: isUserInClub.value,
  imageUrl: false,
  title: true,
  createdDate: true,
  score_average: true,
  ...members.value.reduce<Record<string, boolean>>((acc, member) => {
    acc[`member_${member.id}`] = true;
    return acc;
  }, {}),
}));

const galleryColumnVisibility = {
  edit: false,
  imageUrl: true,
};

const editingTable = ref(false);

const { mutate: deleteReview } = useDeleteListItem(
  clubId,
  WorkListType.reviews,
);

const mdicon = resolveComponent("mdicon");

const columns = computed(() => [
  columnHelper.accessor("imageUrl", {
    header: "Poster",
  }),
  columnHelper.display({
    id: "edit",
    header: () =>
      h(mdicon, {
        name: "pencil",
        class: "cursor-pointer",
        onClick: () => (editingTable.value = !editingTable.value),
      }),
    cell: ({ row }) =>
      editingTable.value
        ? h(mdicon, {
            name: "delete",
            class: "cursor-pointer",
            onClick: () => {
              deleteReview(row.original.id);
            },
          })
        : "",
  }),
  columnHelper.accessor("title", {
    header: "Title",
    meta: {
      class: "font-bold",
    },
  }),
  columnHelper.accessor("createdDate", {
    header: "Date Reviewed",
    cell: (info) => DateTime.fromISO(info.getValue()).toLocaleString(),
  }),
  ...members.value.map((member) =>
    columnHelper.accessor((row) => row.scores[member.id]?.score, {
      id: `member_${member.id}`,
      header: (context) => {
        let size: number | undefined;
        if (typeof context.meta?.size === "string") {
          size = context.meta.size === "sm" ? 28 : undefined;
        }
        return h(VAvatar, {
          src: member.image,
          name: member.name,
          size,
        });
      },
      cell: (info) => {
        const value = info.getValue();
        const score =
          value === undefined ? undefined : Math.round(value * 100) / 100;
        let size: string | undefined;
        if (typeof info.meta?.size === "string") {
          size = info.meta.size;
        }
        return h(ReviewScore, {
          workId: info.row.original.id,
          memberId: member.id,
          score,
          reviewId: info.row.original.scores[member.id]?.id,
          size,
        });
      },
      sortUndefined: "last",
    }),
  ),
  columnHelper.accessor((row) => row.scores.average?.score, {
    id: "score_average",
    header: (context) => {
      let size = "w-16";
      if (typeof context.meta?.size === "string") {
        size = context.meta.size === "sm" ? "w-7 h-7" : "w-16";
      }
      return h("img", { src: AverageImg, class: `${size} max-w-none` });
    },
    cell: (info) => {
      const review = info.getValue();
      if (review === undefined) {
        return "";
      }
      return Math.round(review * 100) / 100;
    },
    sortUndefined: "last",
  }),
]);

const reviewTable = useVueTable({
  get columns() {
    return columns.value;
  },
  get data() {
    return filteredReviews.value ?? [];
  },
  state: {
    get columnVisibility() {
      return {
        ...commonColumnVisibility.value,
        ...(isGalleryView.value ? galleryColumnVisibility : {}),
      };
    },
  },
  getCoreRowModel: getCoreRowModel<DetailedReviewListItem>(),
  getSortedRowModel: getSortedRowModel<DetailedReviewListItem>(),
});
</script>
